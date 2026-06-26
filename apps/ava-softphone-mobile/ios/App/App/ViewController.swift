import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override var autoRegisterPlugins: Bool { false }
    
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CapacitorPjsip())
    }
}
