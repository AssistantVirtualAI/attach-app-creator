//
//  PjsipBridge.mm
//  Objective-C++ implementation that drives PJSUA2.
//
//  REQUIREMENTS (configure once in Xcode after `pod install`):
//   - Build Settings → Header Search Paths: $(PODS_ROOT)/pjsip/include
//   - Build Settings → "Compile Sources As" for this file: Objective-C++
//   - Bridging header: #import "PjsipBridge.h"
//

#import "PjsipBridge.h"

#import <pjsua2.hpp>
#import <pjsua2/account.hpp>
#import <pjsua2/call.hpp>
#import <pjsua2/endpoint.hpp>

using namespace pj;

// ---- C++ subclasses dispatching events back to the ObjC delegate ----------

@class PjsipBridge;

class LemtelCall;

class LemtelAccount : public Account {
public:
    __weak PjsipBridge *bridge;
    void onRegState(OnRegStateParam &prm) override;
    void onIncomingCall(OnIncomingCallParam &iprm) override;
};

class LemtelCall : public Call {
public:
    __weak PjsipBridge *bridge;
    LemtelCall(Account &acc, int call_id = PJSUA_INVALID_ID) : Call(acc, call_id) {}
    void onCallState(OnCallStateParam &prm) override;
    void onCallMediaState(OnCallMediaStateParam &prm) override;
};

// ---- Bridge --------------------------------------------------------------

@interface PjsipBridge () {
    Endpoint        *_ep;
    LemtelAccount   *_acc;
    LemtelCall      *_currentCall;
    BOOL             _started;
}
@end

@implementation PjsipBridge

+ (instancetype)shared {
    static PjsipBridge *s; static dispatch_once_t once;
    dispatch_once(&once, ^{ s = [PjsipBridge new]; });
    return s;
}

- (void)dispatchRegState:(BOOL)reg code:(int)code reason:(NSString *)reason {
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.delegate pjsipRegStateChanged:reg code:code reason:reason ?: @""];
    });
}
- (void)dispatchIncoming:(NSString *)from {
    dispatch_async(dispatch_get_main_queue(), ^{ [self.delegate pjsipIncomingCallFrom:from ?: @""]; });
}
- (void)dispatchCallState:(NSString *)state {
    dispatch_async(dispatch_get_main_queue(), ^{ [self.delegate pjsipCallStateChanged:state ?: @""]; });
}
- (void)dispatchCallEnded:(NSString *)reason {
    dispatch_async(dispatch_get_main_queue(), ^{ [self.delegate pjsipCallEnded:reason ?: @""]; });
}

#pragma mark - Endpoint lifecycle

- (BOOL)initEndpointWithError:(NSError **)error {
    if (_started) return YES;
    try {
        _ep = new Endpoint();
        _ep->libCreate();

        EpConfig epCfg;
        epCfg.logConfig.level = 4;
        epCfg.uaConfig.userAgent = "AVA-Softphone-iOS";
        _ep->libInit(epCfg);

        // TLS transport for WSS (PJSIP uses TLS+WS; PJSUA2 maps WSS via TCP TLS).
        TransportConfig tcfg;
        tcfg.port = 0;
        _ep->transportCreate(PJSIP_TRANSPORT_TLS, tcfg);

        _ep->libStart();
        _started = YES;
        return YES;
    } catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status
                              userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

#pragma mark - Account

- (BOOL)registerAccountWithExtension:(NSString *)extension
                              domain:(NSString *)domain
                            password:(NSString *)password
                              wssUrl:(NSString *)wssUrl
                               error:(NSError **)error {
    if (!_started && ![self initEndpointWithError:error]) return NO;
    try {
        if (_acc) { _acc->shutdown(); delete _acc; _acc = nullptr; }

        AccountConfig acfg;
        acfg.idUri    = [[NSString stringWithFormat:@"sip:%@@%@", extension, domain] UTF8String];
        acfg.regConfig.registrarUri = [[NSString stringWithFormat:@"sip:%@;transport=wss", domain] UTF8String];

        AuthCredInfo cred("digest", "*", [extension UTF8String], 0, [password UTF8String]);
        acfg.sipConfig.authCreds.push_back(cred);

        // Force TURN relay to mirror the WebRTC fallback we use in JsSIP path.
        acfg.natConfig.iceEnabled = true;
        acfg.natConfig.turnEnabled = true;
        acfg.natConfig.turnServer  = "global.relay.metered.ca:443";
        acfg.natConfig.turnUserName = "e499486ca9b7d5a03a01e915";
        acfg.natConfig.turnPassword = "uMFpNAFBoFFUHOdF";
        acfg.natConfig.turnConnType = PJ_TURN_TP_TCP;

        _acc = new LemtelAccount();
        _acc->bridge = self;
        _acc->create(acfg);
        return YES;
    } catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status
                              userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

#pragma mark - Calls

- (BOOL)makeCallTo:(NSString *)number domain:(NSString *)domain error:(NSError **)error {
    if (!_acc) { if (error) *error = [NSError errorWithDomain:@"pjsip" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"No account"}]; return NO; }
    try {
        if (_currentCall) { delete _currentCall; _currentCall = nullptr; }
        _currentCall = new LemtelCall(*_acc);
        _currentCall->bridge = self;
        CallOpParam prm(true);
        std::string dest = [[NSString stringWithFormat:@"sip:%@@%@", number, domain] UTF8String];
        _currentCall->makeCall(dest, prm);
        return YES;
    } catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status
                              userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

- (BOOL)answerCurrentCall:(NSError **)error {
    if (!_currentCall) return NO;
    try { CallOpParam prm; prm.statusCode = PJSIP_SC_OK; _currentCall->answer(prm); return YES; }
    catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

- (BOOL)hangupCurrentCall:(NSError **)error {
    if (!_currentCall) return YES;
    try { CallOpParam prm; prm.statusCode = PJSIP_SC_DECLINE; _currentCall->hangup(prm); return YES; }
    catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

- (BOOL)setMuted:(BOOL)muted error:(NSError **)error {
    try {
        AudDevManager &m = Endpoint::instance().audDevManager();
        // Adjusting capture tx level mutes outbound audio.
        m.setCaptureLevel(muted ? 0 : 100);
        return YES;
    } catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

- (BOOL)setHold:(BOOL)onHold error:(NSError **)error {
    if (!_currentCall) return NO;
    try {
        CallOpParam prm;
        if (onHold) _currentCall->setHold(prm);
        else        _currentCall->reinvite(prm);
        return YES;
    } catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

- (BOOL)sendDtmf:(NSString *)digit error:(NSError **)error {
    if (!_currentCall) return NO;
    try { _currentCall->dialDtmf([digit UTF8String]); return YES; }
    catch (Error &e) {
        if (error) *error = [NSError errorWithDomain:@"pjsip" code:e.status userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithUTF8String:e.info().c_str()]}];
        return NO;
    }
}

@end

// ---- C++ callbacks -------------------------------------------------------

void LemtelAccount::onRegState(OnRegStateParam &prm) {
    AccountInfo ai = getInfo();
    NSString *reason = [NSString stringWithUTF8String:prm.reason.c_str()];
    [bridge dispatchRegState:ai.regIsActive code:prm.code reason:reason];
}

void LemtelAccount::onIncomingCall(OnIncomingCallParam &iprm) {
    LemtelCall *c = new LemtelCall(*this, iprm.callId);
    c->bridge = bridge;
    CallInfo ci = c->getInfo();
    NSString *from = [NSString stringWithUTF8String:ci.remoteUri.c_str()];
    // 180 ringing
    CallOpParam op; op.statusCode = PJSIP_SC_RINGING;
    try { c->answer(op); } catch (...) {}
    [bridge dispatchIncoming:from];
}

void LemtelCall::onCallState(OnCallStateParam &prm) {
    CallInfo ci = getInfo();
    switch (ci.state) {
        case PJSIP_INV_STATE_CALLING:
        case PJSIP_INV_STATE_INCOMING:
        case PJSIP_INV_STATE_EARLY:
            [bridge dispatchCallState:@"ringing"]; break;
        case PJSIP_INV_STATE_CONFIRMED:
            [bridge dispatchCallState:@"active"]; break;
        case PJSIP_INV_STATE_DISCONNECTED:
            [bridge dispatchCallEnded:[NSString stringWithUTF8String:ci.lastReason.c_str()]];
            break;
        default: break;
    }
}

void LemtelCall::onCallMediaState(OnCallMediaStateParam &prm) {
    CallInfo ci = getInfo();
    for (unsigned i = 0; i < ci.media.size(); i++) {
        if (ci.media[i].type == PJMEDIA_TYPE_AUDIO && getMedia(i)) {
            AudioMedia *am = static_cast<AudioMedia*>(getMedia(i));
            AudDevManager &mgr = Endpoint::instance().audDevManager();
            mgr.getCaptureDevMedia().startTransmit(*am);
            am->startTransmit(mgr.getPlaybackDevMedia());
        }
    }
}
