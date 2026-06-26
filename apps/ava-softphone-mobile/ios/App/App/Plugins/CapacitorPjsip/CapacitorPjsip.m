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
