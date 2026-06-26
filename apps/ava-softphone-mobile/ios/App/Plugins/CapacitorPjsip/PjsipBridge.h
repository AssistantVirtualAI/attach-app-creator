//
//  PjsipBridge.h
//  Pure Objective-C interface around PJSUA2 (C++). Imported into Swift via
//  the bridging header so CapacitorPjsip.swift never touches C++ directly.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol PjsipBridgeDelegate <NSObject>
- (void)pjsipRegStateChanged:(BOOL)registered code:(int)code reason:(NSString *)reason;
- (void)pjsipIncomingCallFrom:(NSString *)from;
- (void)pjsipCallStateChanged:(NSString *)state;
- (void)pjsipCallEnded:(NSString *)reason;
@end

@interface PjsipBridge : NSObject

@property (nonatomic, weak) id<PjsipBridgeDelegate> delegate;

+ (instancetype)shared;

- (BOOL)initEndpointWithError:(NSError **)error;

- (BOOL)registerAccountWithExtension:(NSString *)extension
                              domain:(NSString *)domain
                            password:(NSString *)password
                              wssUrl:(NSString *)wssUrl
                               error:(NSError **)error;

- (BOOL)makeCallTo:(NSString *)number domain:(NSString *)domain error:(NSError **)error;
- (BOOL)answerCurrentCall:(NSError **)error;
- (BOOL)hangupCurrentCall:(NSError **)error;
- (BOOL)setMuted:(BOOL)muted error:(NSError **)error;
- (BOOL)setHold:(BOOL)onHold error:(NSError **)error;
- (BOOL)sendDtmf:(NSString *)digit error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
