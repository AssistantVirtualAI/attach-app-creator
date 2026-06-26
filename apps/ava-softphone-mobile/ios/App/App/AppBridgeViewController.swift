import UIKit
import Capacitor

/// Custom bridge view controller that manually registers locally-compiled
/// (app-target) Capacitor plugins. Capacitor 6 auto-discovery only covers
/// plugins shipped via CocoaPods, so app-target plugins must be registered
/// here in `capacitorDidLoad()`.
@objc(AppBridgeViewController)
class AppBridgeViewController: CAPBridgeViewController {

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        NSLog("[AppBridge] init(coder:) — AppBridgeViewController instantiated from storyboard")
    }

    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
        NSLog("[AppBridge] init(nibName:) — AppBridgeViewController instantiated")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        NSLog("[AppBridge] viewDidLoad — class=\(String(describing: type(of: self)))")
    }

    override func capacitorDidLoad() {
        NSLog("[AppBridge] capacitorDidLoad — registering local plugins")
        let plugin = CapacitorPjsip()
        bridge?.registerPluginInstance(plugin)
        NSLog("[AppBridge] CapacitorPjsip registered: \(plugin)")
    }
}
