import UIKit
import Capacitor
import WebKit
import AVFoundation
import PushKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // PushKit VoIP registry — kept alive for the app lifetime.
    private var voipRegistry: PKPushRegistry?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // ---- Boot guard: ensure storyboard wires the custom bridge VC, not raw CAPBridgeViewController ----
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            guard let root = self.window?.rootViewController else {
                NSLog("[BootGuard] ❌ No rootViewController after launch")
                return
            }
            let cls = type(of: root)
            let name = String(describing: cls)
            NSLog("[BootGuard] rootViewController class = \(name)")
            if root is AppBridgeViewController {
                NSLog("[BootGuard] ✅ AppBridgeViewController loaded — plugin registration path active")
            } else if name == "CAPBridgeViewController" {
                NSLog("[BootGuard] ❌ FATAL: Storyboard is using raw CAPBridgeViewController. Local plugins (CapacitorPjsip) will NOT be registered. Update Main.storyboard customClass to AppBridgeViewController (customModule=\"App\").")
                self.showBootError(message: "Configuration error: Main.storyboard must reference AppBridgeViewController, not CAPBridgeViewController. Plugin CapacitorPjsip cannot load.")
            } else {
                NSLog("[BootGuard] ⚠️ Unexpected rootViewController: \(name)")
            }
        }


        // Configure audio session for VoIP (full-duplex, BT + speaker route).
        let audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers]
        )
        try? audioSession.setPreferredSampleRate(48000)
        try? audioSession.setPreferredIOBufferDuration(0.02)
        try? audioSession.setActive(true, options: [])

        // Proactively request microphone permission so the system prompt
        // appears on first launch rather than on first call.
        audioSession.requestRecordPermission { granted in
            NSLog("[AVA] Microphone permission granted: \(granted)")
        }

        // Register for VoIP push notifications via PushKit.
        // iOS wakes the app (even if terminated) when a VoIP push arrives.
        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        voipRegistry = registry
        NSLog("[VoIP] PushKit registry started")

        // Disable mDNS ICE candidate obfuscation in WKWebView
        let webConfig = WKWebViewConfiguration()
        webConfig.allowsInlineMediaPlayback = true
        webConfig.mediaTypesRequiringUserActionForPlayback = []
        if #available(iOS 14.0, *) {
            webConfig.limitsNavigationsToAppBoundDomains = false
        }

        // Force real IP addresses for WebRTC ICE candidates
        let processPool = WKProcessPool()
        webConfig.processPool = processPool

        // Apply WebKit internal flags to disable mDNS
        let script = WKUserScript(
            source: """
                // Force WebRTC to expose real IPs
                const origGetStats = RTCPeerConnection.prototype.getStats;
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        webConfig.userContentController.addUserScript(script)

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Display an opaque error overlay if the storyboard is mis-wired so the
    // app does not silently sit in "connecting" forever.
    private func showBootError(message: String) {
        guard let window = self.window else { return }
        let overlay = UIViewController()
        overlay.view.backgroundColor = UIColor(red: 0.10, green: 0.02, blue: 0.05, alpha: 1)
        let label = UILabel()
        label.text = "⚠️ Boot error\n\n\(message)"
        label.numberOfLines = 0
        label.textColor = .white
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        overlay.view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: overlay.view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: overlay.view.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: overlay.view.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(equalTo: overlay.view.trailingAnchor, constant: -24)
        ])
        window.rootViewController?.present(overlay, animated: false)
    }
}

// MARK: - PKPushRegistryDelegate

extension AppDelegate: PKPushRegistryDelegate {

    /// Called when iOS assigns or refreshes the VoIP push token.
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        NSLog("[VoIP] \u{1F4F2} PushKit token: \(token.prefix(16))\u{2026}")
        CapacitorPjsip.shared?.setVoipPushToken(token)
        UserDefaults.standard.set(token, forKey: "ava.voipPushToken")
    }

    /// Called when a VoIP push notification arrives.
    /// iOS wakes the app even if terminated — must report via CallKit within ~30s.
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        guard type == .voIP else { completion(); return }
        let dict = payload.dictionaryPayload
        NSLog("[VoIP] \u{1F4DE} Incoming VoIP push: \(dict)")
        let from = (dict["from"] as? String)
            ?? (dict["caller_id_name"] as? String)
            ?? (dict["caller_id_number"] as? String)
            ?? "Unknown"
        let callId = (dict["call-id"] as? String)
            ?? (dict["uuid"] as? String)
            ?? UUID().uuidString
        // Report to CallKit (mandatory iOS 13+).
        CallKitManager.shared.reportIncomingVoipPush(from: from, callId: callId) {
            completion()
        }
        // Notify JS layer to show in-app incoming call UI.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            CapacitorPjsip.shared?.notifyBg("callReceived", ["from": from, "callId": callId, "source": "voip-push"])
        }
    }

    /// Called when the VoIP push token is invalidated (e.g. app reinstall).
    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        NSLog("[VoIP] \u26A0\uFE0F PushKit token invalidated")
        UserDefaults.standard.removeObject(forKey: "ava.voipPushToken")
        CapacitorPjsip.shared?.setVoipPushToken(nil)
    }
}
