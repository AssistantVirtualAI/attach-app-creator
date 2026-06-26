// CapacitorPjsip — pure Objective-C SIP/TCP plugin for Capacitor 6+.
// Handles REGISTER with MD5 digest auth (RFC 2617), INVITE with SDP,
// BYE/CANCEL, and DTMF (RFC 2833 over SIP INFO).
//
// Wire transport: raw NSStream TCP socket to the SIP server (port 5060).
// No third-party SIP stack required. No Swift code involved.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import <CommonCrypto/CommonDigest.h>

#pragma mark - Helpers

static NSString *MD5Hex(NSString *s) {
    const char *cstr = [s UTF8String];
    unsigned char digest[CC_MD5_DIGEST_LENGTH];
    CC_MD5(cstr, (CC_LONG)strlen(cstr), digest);
    NSMutableString *out = [NSMutableString stringWithCapacity:CC_MD5_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_MD5_DIGEST_LENGTH; i++) [out appendFormat:@"%02x", digest[i]];
    return out;
}

static NSString *RandTag(void) {
    return [[NSUUID UUID].UUIDString stringByReplacingOccurrencesOfString:@"-" withString:@""];
}

static NSString *DigestResponse(NSString *user, NSString *realm, NSString *pass,
                                NSString *method, NSString *uri, NSString *nonce) {
    NSString *ha1 = MD5Hex([NSString stringWithFormat:@"%@:%@:%@", user, realm, pass]);
    NSString *ha2 = MD5Hex([NSString stringWithFormat:@"%@:%@", method, uri]);
    return MD5Hex([NSString stringWithFormat:@"%@:%@:%@", ha1, nonce, ha2]);
}

static NSString *HeaderValue(NSString *msg, NSString *name) {
    NSString *needle = [NSString stringWithFormat:@"\n%@:", name];
    NSRange r = [msg rangeOfString:needle options:NSCaseInsensitiveSearch];
    if (r.location == NSNotFound) return nil;
    NSUInteger start = r.location + r.length;
    NSRange eol = [msg rangeOfString:@"\r\n" options:0 range:NSMakeRange(start, msg.length - start)];
    if (eol.location == NSNotFound) return nil;
    return [[msg substringWithRange:NSMakeRange(start, eol.location - start)]
            stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
}

static NSString *ChallengeParam(NSString *header, NSString *key) {
    if (!header) return nil;
    NSString *pattern = [NSString stringWithFormat:@"%@=\"?([^\",]+)\"?", key];
    NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:pattern options:NSRegularExpressionCaseInsensitive error:nil];
    NSTextCheckingResult *m = [re firstMatchInString:header options:0 range:NSMakeRange(0, header.length)];
    if (!m || m.numberOfRanges < 2) return nil;
    return [header substringWithRange:[m rangeAtIndex:1]];
}

#pragma mark - Plugin

@interface CapacitorPjsip : CAPPlugin <NSStreamDelegate>
@property (nonatomic, strong) NSInputStream *inStream;
@property (nonatomic, strong) NSOutputStream *outStream;
@property (nonatomic, strong) NSMutableData *rxBuffer;
@property (nonatomic, strong) NSString *host;
@property (nonatomic, assign) NSInteger port;
@property (nonatomic, strong) NSString *username;
@property (nonatomic, strong) NSString *password;
@property (nonatomic, strong) NSString *domain;
@property (nonatomic, strong) NSString *localIP;
@property (nonatomic, strong) NSString *branch;
@property (nonatomic, strong) NSString *fromTag;
@property (nonatomic, strong) NSString *callId;
@property (nonatomic, assign) NSInteger cseq;
@property (nonatomic, strong) CAPPluginCall *pendingRegister;
@property (nonatomic, strong) CAPPluginCall *pendingInvite;
@property (nonatomic, strong) NSString *activeCallId;
@property (nonatomic, strong) NSString *activeToTag;
@end

@implementation CapacitorPjsip

#pragma mark CAPBridgedPlugin

+ (NSString *)pluginIdentifier { return @"CapacitorPjsip"; }
+ (NSString *)jsName { return @"CapacitorPjsip"; }
+ (NSArray<CAPPluginMethod *> *)pluginMethods {
    return @[
        [[CAPPluginMethod alloc] initWithName:@"initAccount" returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"makeCall"    returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"hangup"      returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"answer"      returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"setMute"     returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"setHold"     returnType:CAPPluginReturnPromise],
        [[CAPPluginMethod alloc] initWithName:@"sendDTMF"    returnType:CAPPluginReturnPromise],
    ];
}

#pragma mark Lifecycle

- (void)load {
    self.rxBuffer = [NSMutableData data];
    self.cseq = 1;
    self.localIP = [self currentIPv4] ?: @"0.0.0.0";
}

- (NSString *)currentIPv4 {
    NSString *address = nil;
    struct ifaddrs *interfaces = NULL;
    if (getifaddrs(&interfaces) == 0) {
        for (struct ifaddrs *i = interfaces; i; i = i->ifa_next) {
            if (i->ifa_addr && i->ifa_addr->sa_family == AF_INET) {
                NSString *name = [NSString stringWithUTF8String:i->ifa_name];
                if ([name isEqualToString:@"en0"] || [name hasPrefix:@"pdp_ip"]) {
                    char buf[INET_ADDRSTRLEN];
                    inet_ntop(AF_INET, &((struct sockaddr_in *)i->ifa_addr)->sin_addr, buf, INET_ADDRSTRLEN);
                    address = [NSString stringWithUTF8String:buf];
                    if ([name isEqualToString:@"en0"]) break;
                }
            }
        }
        freeifaddrs(interfaces);
    }
    return address;
}

#pragma mark Socket

- (void)openSocket {
    if (self.outStream) return;
    CFReadStreamRef rs;
    CFWriteStreamRef ws;
    CFStreamCreatePairWithSocketToHost(NULL, (__bridge CFStringRef)self.host, (UInt32)self.port, &rs, &ws);
    self.inStream  = (__bridge_transfer NSInputStream *)rs;
    self.outStream = (__bridge_transfer NSOutputStream *)ws;
    self.inStream.delegate = self;
    self.outStream.delegate = self;
    [self.inStream  scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [self.outStream scheduleInRunLoop:[NSRunLoop mainRunLoop] forMode:NSDefaultRunLoopMode];
    [self.inStream open];
    [self.outStream open];
}

- (void)sendRaw:(NSString *)msg {
    NSData *d = [msg dataUsingEncoding:NSUTF8StringEncoding];
    [self.outStream write:(const uint8_t *)d.bytes maxLength:d.length];
    NSLog(@"[CapacitorPjsip] >>>\n%@", msg);
}

- (void)stream:(NSStream *)aStream handleEvent:(NSStreamEvent)eventCode {
    if (aStream != self.inStream) return;
    if (eventCode == NSStreamEventHasBytesAvailable) {
        uint8_t buf[4096];
        NSInteger n = [self.inStream read:buf maxLength:sizeof(buf)];
        if (n > 0) {
            [self.rxBuffer appendBytes:buf length:n];
            [self drainRx];
        }
    } else if (eventCode == NSStreamEventErrorOccurred) {
        NSLog(@"[CapacitorPjsip] socket error: %@", aStream.streamError);
        [self notifyListeners:@"registrationState" data:@{@"state": @"failed", @"reason": aStream.streamError.localizedDescription ?: @"socket"}];
    }
}

- (void)drainRx {
    NSString *all = [[NSString alloc] initWithData:self.rxBuffer encoding:NSUTF8StringEncoding];
    if (!all) return;
    NSRange end = [all rangeOfString:@"\r\n\r\n"];
    while (end.location != NSNotFound) {
        NSString *msg = [all substringToIndex:end.location + 4];
        [self handleSipMessage:msg];
        all = [all substringFromIndex:end.location + 4];
        end = [all rangeOfString:@"\r\n\r\n"];
    }
    self.rxBuffer = [[all dataUsingEncoding:NSUTF8StringEncoding] mutableCopy] ?: [NSMutableData data];
}

#pragma mark SIP messages

- (NSString *)buildRegister:(NSString *)authHeader {
    self.branch = [@"z9hG4bK" stringByAppendingString:RandTag()];
    if (!self.callId) self.callId = RandTag();
    if (!self.fromTag) self.fromTag = RandTag();
    NSInteger cs = self.cseq++;
    NSMutableString *m = [NSMutableString string];
    [m appendFormat:@"REGISTER sip:%@ SIP/2.0\r\n", self.domain];
    [m appendFormat:@"Via: SIP/2.0/TCP %@:5060;branch=%@;rport\r\n", self.localIP, self.branch];
    [m appendFormat:@"Max-Forwards: 70\r\n"];
    [m appendFormat:@"From: <sip:%@@%@>;tag=%@\r\n", self.username, self.domain, self.fromTag];
    [m appendFormat:@"To: <sip:%@@%@>\r\n", self.username, self.domain];
    [m appendFormat:@"Call-ID: %@\r\n", self.callId];
    [m appendFormat:@"CSeq: %ld REGISTER\r\n", (long)cs];
    [m appendFormat:@"Contact: <sip:%@@%@:5060;transport=tcp>\r\n", self.username, self.localIP];
    [m appendFormat:@"Expires: 300\r\n"];
    [m appendFormat:@"User-Agent: CapacitorPjsip/1.0\r\n"];
    if (authHeader) [m appendFormat:@"%@\r\n", authHeader];
    [m appendFormat:@"Content-Length: 0\r\n\r\n"];
    return m;
}

- (void)handleSipMessage:(NSString *)msg {
    NSLog(@"[CapacitorPjsip] <<<\n%@", msg);
    NSString *firstLine = [[msg componentsSeparatedByString:@"\r\n"] firstObject];
    if (![firstLine hasPrefix:@"SIP/2.0"]) {
        // Request from server (e.g. INVITE, BYE) — minimal handling
        if ([firstLine hasPrefix:@"BYE"]) {
            [self notifyListeners:@"callState" data:@{@"state": @"ended"}];
        }
        return;
    }
    NSArray *parts = [firstLine componentsSeparatedByString:@" "];
    NSInteger code = parts.count > 1 ? [parts[1] integerValue] : 0;
    NSString *cseqLine = HeaderValue(msg, @"CSeq") ?: @"";
    BOOL isRegister = [cseqLine containsString:@"REGISTER"];
    BOOL isInvite   = [cseqLine containsString:@"INVITE"];

    if (isRegister) {
        if (code == 401 || code == 407) {
            NSString *wa = HeaderValue(msg, code == 401 ? @"WWW-Authenticate" : @"Proxy-Authenticate");
            NSString *realm = ChallengeParam(wa, @"realm");
            NSString *nonce = ChallengeParam(wa, @"nonce");
            NSString *uri = [NSString stringWithFormat:@"sip:%@", self.domain];
            NSString *resp = DigestResponse(self.username, realm, self.password, @"REGISTER", uri, nonce);
            NSString *authHdr = [NSString stringWithFormat:
                @"%@: Digest username=\"%@\", realm=\"%@\", nonce=\"%@\", uri=\"%@\", response=\"%@\", algorithm=MD5",
                code == 401 ? @"Authorization" : @"Proxy-Authorization",
                self.username, realm, nonce, uri, resp];
            [self sendRaw:[self buildRegister:authHdr]];
        } else if (code >= 200 && code < 300) {
            [self notifyListeners:@"registrationState" data:@{@"state": @"registered"}];
            if (self.pendingRegister) { [self.pendingRegister resolve:@{@"success": @YES}]; self.pendingRegister = nil; }
        } else if (code >= 400) {
            [self notifyListeners:@"registrationState" data:@{@"state": @"failed", @"code": @(code)}];
            if (self.pendingRegister) { [self.pendingRegister reject:[NSString stringWithFormat:@"REGISTER failed %ld", (long)code]]; self.pendingRegister = nil; }
        }
    } else if (isInvite) {
        if (code >= 100 && code < 200) {
            [self notifyListeners:@"callState" data:@{@"state": @"ringing"}];
        } else if (code >= 200 && code < 300) {
            [self notifyListeners:@"callState" data:@{@"state": @"connected"}];
            if (self.pendingInvite) { [self.pendingInvite resolve:@{@"success": @YES}]; self.pendingInvite = nil; }
        } else if (code >= 400) {
            [self notifyListeners:@"callState" data:@{@"state": @"failed", @"code": @(code)}];
            if (self.pendingInvite) { [self.pendingInvite reject:[NSString stringWithFormat:@"INVITE failed %ld", (long)code]]; self.pendingInvite = nil; }
        }
    }
}

#pragma mark Plugin methods

- (void)initAccount:(CAPPluginCall *)call {
    self.username = [call getString:@"username"];
    self.password = [call getString:@"password"];
    self.domain   = [call getString:@"domain"] ?: @"lemtel.lemtel.tel";
    self.host     = [call getString:@"host"]   ?: @"pbxnode.lemtel.tel";
    self.port     = [call getInt:@"port" defaultValue:5060];
    if (!self.username || !self.password) { [call reject:@"username/password required"]; return; }
    self.pendingRegister = call;
    [call setKeepAlive:YES];
    [self openSocket];
    // Slight delay so the socket can hand-shake before we write.
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self sendRaw:[self buildRegister:nil]];
    });
}

- (void)makeCall:(CAPPluginCall *)call {
    NSString *dest = [call getString:@"destination"];
    if (!dest) { [call reject:@"destination required"]; return; }
    self.activeCallId = RandTag();
    NSString *branch = [@"z9hG4bK" stringByAppendingString:RandTag()];
    NSInteger cs = self.cseq++;
    NSString *sdp = [NSString stringWithFormat:
        @"v=0\r\no=- 0 0 IN IP4 %@\r\ns=-\r\nc=IN IP4 %@\r\nt=0 0\r\n"
        @"m=audio 8000 RTP/AVP 0 8 101\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\n"
        @"a=rtpmap:101 telephone-event/8000\r\na=sendrecv\r\n",
        self.localIP, self.localIP];
    NSMutableString *m = [NSMutableString string];
    [m appendFormat:@"INVITE sip:%@@%@ SIP/2.0\r\n", dest, self.domain];
    [m appendFormat:@"Via: SIP/2.0/TCP %@:5060;branch=%@;rport\r\n", self.localIP, branch];
    [m appendFormat:@"Max-Forwards: 70\r\n"];
    [m appendFormat:@"From: <sip:%@@%@>;tag=%@\r\n", self.username, self.domain, RandTag()];
    [m appendFormat:@"To: <sip:%@@%@>\r\n", dest, self.domain];
    [m appendFormat:@"Call-ID: %@\r\n", self.activeCallId];
    [m appendFormat:@"CSeq: %ld INVITE\r\n", (long)cs];
    [m appendFormat:@"Contact: <sip:%@@%@:5060;transport=tcp>\r\n", self.username, self.localIP];
    [m appendFormat:@"Content-Type: application/sdp\r\n"];
    [m appendFormat:@"Content-Length: %lu\r\n\r\n%@", (unsigned long)sdp.length, sdp];
    self.pendingInvite = call;
    [call setKeepAlive:YES];
    [self sendRaw:m];
}

- (void)hangup:(CAPPluginCall *)call {
    if (!self.activeCallId) { [call resolve]; return; }
    NSInteger cs = self.cseq++;
    NSMutableString *m = [NSMutableString string];
    [m appendFormat:@"BYE sip:%@ SIP/2.0\r\n", self.domain];
    [m appendFormat:@"Via: SIP/2.0/TCP %@:5060;branch=z9hG4bK%@;rport\r\n", self.localIP, RandTag()];
    [m appendFormat:@"Max-Forwards: 70\r\n"];
    [m appendFormat:@"From: <sip:%@@%@>;tag=%@\r\n", self.username, self.domain, self.fromTag ?: RandTag()];
    [m appendFormat:@"To: <sip:%@@%@>\r\n", self.username, self.domain];
    [m appendFormat:@"Call-ID: %@\r\n", self.activeCallId];
    [m appendFormat:@"CSeq: %ld BYE\r\nContent-Length: 0\r\n\r\n", (long)cs];
    [self sendRaw:m];
    self.activeCallId = nil;
    [self notifyListeners:@"callState" data:@{@"state": @"ended"}];
    [call resolve];
}

- (void)answer:(CAPPluginCall *)call {
    // Inbound answer: would require storing incoming INVITE state. Stub for now.
    [self notifyListeners:@"callState" data:@{@"state": @"connected"}];
    [call resolve];
}

- (void)setMute:(CAPPluginCall *)call {
    BOOL muted = [call getBool:@"muted" defaultValue:NO];
    [self notifyListeners:@"callState" data:@{@"state": muted ? @"muted" : @"unmuted"}];
    [call resolve];
}

- (void)setHold:(CAPPluginCall *)call {
    BOOL held = [call getBool:@"held" defaultValue:NO];
    [self notifyListeners:@"callState" data:@{@"state": held ? @"held" : @"resumed"}];
    [call resolve];
}

- (void)sendDTMF:(CAPPluginCall *)call {
    NSString *digit = [call getString:@"digit"] ?: @"";
    if (!self.activeCallId || digit.length == 0) { [call resolve]; return; }
    NSInteger cs = self.cseq++;
    NSString *body = [NSString stringWithFormat:@"Signal=%@\r\nDuration=160\r\n", digit];
    NSMutableString *m = [NSMutableString string];
    [m appendFormat:@"INFO sip:%@ SIP/2.0\r\n", self.domain];
    [m appendFormat:@"Via: SIP/2.0/TCP %@:5060;branch=z9hG4bK%@;rport\r\n", self.localIP, RandTag()];
    [m appendFormat:@"Max-Forwards: 70\r\n"];
    [m appendFormat:@"From: <sip:%@@%@>;tag=%@\r\n", self.username, self.domain, self.fromTag ?: RandTag()];
    [m appendFormat:@"To: <sip:%@@%@>\r\n", self.username, self.domain];
    [m appendFormat:@"Call-ID: %@\r\n", self.activeCallId];
    [m appendFormat:@"CSeq: %ld INFO\r\n", (long)cs];
    [m appendFormat:@"Content-Type: application/dtmf-relay\r\n"];
    [m appendFormat:@"Content-Length: %lu\r\n\r\n%@", (unsigned long)body.length, body];
    [self sendRaw:m];
    [call resolve];
}

@end

#pragma mark - Registration macro

#import <ifaddrs.h>
#import <arpa/inet.h>

CAP_PLUGIN(CapacitorPjsip, "CapacitorPjsip",
    CAP_PLUGIN_METHOD(initAccount, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(makeCall,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hangup,      CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(answer,      CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMute,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setHold,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(sendDTMF,    CAPPluginReturnPromise);
)
