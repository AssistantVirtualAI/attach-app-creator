import Foundation
import CallKit
import AVFoundation
import UIKit

/// Minimal CallKit bridge so PJSIP-driven calls show up as native iOS calls
/// (lockscreen UI, audio session priming, background ringing). The plugin
/// reports incoming/outgoing/ended events here; CXProvider handles the UI
/// and tells iOS to configure the AVAudioSession before PJSIP starts media.
@objc public final class CallKitManager: NSObject {
    @objc public static let shared = CallKitManager()

    private let provider: CXProvider
    private let callController = CXCallController()
    private var activeUUID: UUID?

    /// Called by CallKit when the user taps Answer in the native UI.
    /// Plugin assigns this so it can forward the action to PJSIP.
    public var onAnswer: (() -> Void)?
    /// Called by CallKit when the user taps End in the native UI.
    public var onEnd: (() -> Void)?
    /// Called by CallKit when the audio session is activated.
    /// CapacitorSip dispatches pjsua_set_snd_dev on sipQueue from this callback.
    public var onAudioActivated: (() -> Void)?

    private override init() {
        let cfg = CXProviderConfiguration(localizedName: "Lemtel")
        cfg.supportsVideo = false
        cfg.maximumCallsPerCallGroup = 1
        cfg.supportedHandleTypes = [.phoneNumber, .generic]
        provider = CXProvider(configuration: cfg)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    @objc public func reportIncoming(from: String) {
        let uuid = UUID()
        activeUUID = uuid
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: from)
        update.hasVideo = false
        provider.reportNewIncomingCall(with: uuid, update: update) { _ in }
    }

    /// Called by AppDelegate when a VoIP push notification arrives.
    /// iOS 13+ requires reporting an incoming call via CallKit within the
    /// PKPushRegistryDelegate callback — otherwise the app is killed.
    /// The `completion` block MUST be called to satisfy the PushKit requirement.
    public func reportIncomingVoipPush(from: String, callId: String, completion: @escaping () -> Void) {
        let uuid = UUID()
        activeUUID = uuid
        let update = CXCallUpdate()
        // Display the caller ID from the push payload.
        let displayName = from
            .replacingOccurrences(of: "sip:", with: "")
            .components(separatedBy: "@").first ?? from
        update.remoteHandle = CXHandle(type: .generic, value: displayName)
        update.localizedCallerName = displayName
        update.hasVideo = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                NSLog("[CallKitManager] ⚠️ reportNewIncomingCall error: \(error)")
            } else {
                NSLog("[CallKitManager] 📞 Incoming VoIP push call reported to CallKit: \(displayName)")
            }
            completion()
        }
    }

    @objc public func reportOutgoing(to: String) {
        let uuid = UUID()
        activeUUID = uuid
        let handle = CXHandle(type: .generic, value: to)
        let start = CXStartCallAction(call: uuid, handle: handle)
        callController.request(CXTransaction(action: start)) { _ in }
        provider.reportOutgoingCall(with: uuid, startedConnectingAt: nil)
    }

    @objc public func reportConnected() {
        guard let uuid = activeUUID else { return }
        provider.reportOutgoingCall(with: uuid, connectedAt: nil)
    }

    @objc public func reportEnded() {
        guard let uuid = activeUUID else { return }
        provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
        activeUUID = nil
    }
}

extension CallKitManager: CXProviderDelegate {
    public func providerDidReset(_ provider: CXProvider) { activeUUID = nil }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        onAnswer?()
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        onEnd?()
        action.fulfill()
        activeUUID = nil
    }

    public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        action.fulfill()
    }

    /// iOS has activated the audio session — forward to CapacitorSip which will
    /// call pjsua_set_snd_dev on the PJLIB-registered sipQueue thread.
    /// NEVER call pjsua_set_snd_dev directly here: CallKit runs this on its own
    /// internal thread which is NOT registered in PJLIB → assertion crash.
    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        print("[CallKitManager] ✅ AVAudioSession activated by CallKit")
        onAudioActivated?()
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        print("[CallKitManager] 🔇 AVAudioSession deactivated by CallKit")
    }
}
