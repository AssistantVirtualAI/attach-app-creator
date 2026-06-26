import UIKit
import Capacitor

/// Custom bridge view controller that manually registers locally-compiled
/// (app-target) Capacitor plugins. Capacitor 6 auto-discovery only covers
/// plugins shipped via CocoaPods, so app-target plugins must be registered
/// here in `capacitorDidLoad()`.
@objc(AppBridgeViewController)
class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        NSLog("[AppBridge] capacitorDidLoad — registering local plugins")
        let plugin = CapacitorPjsip()
        bridge?.registerPluginInstance(plugin)
        NSLog("[AppBridge] CapacitorPjsip registered: \(plugin)")
    }
}
