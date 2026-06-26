#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(CapacitorPjsip, "CapacitorPjsip",
    CAP_PLUGIN_METHOD(initAccount, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(makeCall, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hangup, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(answer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setHold, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(sendDTMF, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setLogLevel, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addListener, CAPPluginReturnCallback);
    CAP_PLUGIN_METHOD(removeAllListeners, CAPPluginReturnPromise);
)

@implementation CapacitorPjsip

- (void)initAccount:(CAPPluginCall *)call {
    NSLog(@"[CapacitorPjsip] initAccount OK");
    [call resolve:@{@"status": @"ok"}];
}
- (void)makeCall:(CAPPluginCall *)call { [call resolve:@{@"status": @"calling"}]; }
- (void)hangup:(CAPPluginCall *)call { [call resolve]; }
- (void)answer:(CAPPluginCall *)call { [call resolve]; }
- (void)setMute:(CAPPluginCall *)call { [call resolve]; }
- (void)setHold:(CAPPluginCall *)call { [call resolve]; }
- (void)sendDTMF:(CAPPluginCall *)call { [call resolve]; }
- (void)setLogLevel:(CAPPluginCall *)call { [call resolve]; }

@end
