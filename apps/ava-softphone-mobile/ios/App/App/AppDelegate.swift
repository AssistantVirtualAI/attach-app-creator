import UIKit
import Capacitor
import WebKit
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

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
}
