// Intentionally empty.
// The active local plugin is registered from
// App/App/Plugins/CapacitorSip/CapacitorSip.swift via CAPBridgedPlugin and
// AppBridgeViewController.registerPluginInstance(_:). This stale root-level
// bridge used to expose an incomplete method list (no startRecord/park/etc.)
// and could make native fixes look missing after a sync.
