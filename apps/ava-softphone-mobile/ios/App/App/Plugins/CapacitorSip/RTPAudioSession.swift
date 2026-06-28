import Foundation
import AVFoundation
import AudioToolbox
import Darwin

/// PCMU (G.711 μ-law) RTP audio session backed by a single BSD UDP socket
/// for symmetric send/receive. Capture/playback uses only a low-level RemoteIO
/// AudioUnit (kAudioUnitSubType_RemoteIO) so the mobile softphone has one
/// native audio owner and avoids iOS hardware category conflicts.
final class RTPAudioSession {
    // MARK: - Public state
    private(set) var localPort: UInt16 = 0
    private(set) var localIp: String = "0.0.0.0"

    // MARK: - Socket
    private var sockfd: Int32 = -1
    private var remoteAddr: sockaddr_in = sockaddr_in()
    private var hasRemote = false
    private let rxQueue = DispatchQueue(label: "rtp.audio.rx", qos: .userInteractive)
    private let txQueue = DispatchQueue(label: "rtp.audio.tx", qos: .userInteractive)

    // MARK: - RemoteIO AudioUnit
    private var ioUnit: AudioUnit?
    /// Hardware sample rate. PINNED to 48000Hz — iOS RemoteIO rejects 8000Hz
    /// (kAudioUnitErr_FormatNotSupported / 561017449) and reading the session
    /// rate mid-setup can return 0Hz. We hard-pin to 48000 and request it via
    /// setPreferredSampleRate; resample to/from 8000Hz for RTP PCMU.
    private let hwSampleRate: Double = 48000
    /// RTP/PCMU codec rate (G.711 μ-law).
    private let rtpSampleRate: Double = 8000
    /// Integer decimation factor 48000 → 8000.
    private let decimation: Int = 6
    private let channels: UInt32 = 1
    /// Scratch buffer used inside the input callback to receive captured PCM.
    private var captureScratch: UnsafeMutablePointer<Int16>?
    private var captureScratchFrames: UInt32 = 0
    /// Fractional resampling phase accumulators (zero-order hold).
    private var txPhase: Double = 0
    private var rxPhase: Double = 0
    private var rxHoldSample: Int16 = 0

    // MARK: - RTP
    private var sequenceNumber: UInt16 = UInt16.random(in: 0...UInt16.max)
    private var timestamp: UInt32 = UInt32.random(in: 0...UInt32.max)
    private let ssrc: UInt32 = UInt32.random(in: 0...UInt32.max)
    private let frameSamples: Int = 160 // 20ms @ 8kHz
    private var isMuted = false
    private var running = false
    private var audioPrepared = false

    // MARK: - Audio buffers (lock-protected)
    private let audioLock = NSLock()
    /// Outgoing PCM samples (already decimated to 8kHz) awaiting RTP framing.
    private var sendBuffer = [Int16]()
    /// Raw 48kHz mic samples awaiting 6-sample averaging downsample.
    private var downsampleAccum = [Int16]()
    /// Incoming PCM jitter buffer at 8kHz drained by the render callback.
    private var playQueue = [Int16]()
    private let maxPlayQueueSamples = 8000 // ~1s safety cap
    /// Minimum jitter buffer prime before playback starts (3 packets = 60ms @ 8kHz).
    private let minBufferPackets = 3
    private let minBufferSamples = 3 * 160
    private var bufferPrimed = false
    /// Linear interpolation state for 8k→48k upsample.
    private var prevRxSample: Int16 = 0
    private var currRxSample: Int16 = 0
    private var rxInterpStep: Int = 0  // 0..decimation-1

    // MARK: - Engine recovery
    private var engineRestartAttempts: Int = 0
    private var engineRestartTimer: DispatchSourceTimer?
    private var routeChangeObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var mediaServicesResetObserver: NSObjectProtocol?
    private(set) var lastEngineError: String = ""
    private(set) var engineRestartTotal: Int = 0

    /// Wired by CapacitorSip to surface audio engine state to JS.
    /// Status values: "starting" | "running" | "retrying" | "error" | "idle".
    var onAudioStateChanged: ((String, [String: Any]) -> Void)?
    private func emitAudio(_ status: String, _ extra: [String: Any] = [:]) {
        var data: [String: Any] = ["status": status,
                                   "restartAttempts": engineRestartAttempts,
                                   "restartTotal": engineRestartTotal,
                                   "lastError": lastEngineError]
        for (k, v) in extra { data[k] = v }
        onAudioStateChanged?(status, data)
    }

    // MARK: - Diagnostics
    private(set) var txPackets: UInt64 = 0
    private(set) var rxPackets: UInt64 = 0
    private(set) var txBytes: UInt64 = 0
    private(set) var rxBytes: UInt64 = 0
    private(set) var lastRemoteSeq: UInt16 = 0
    private(set) var lastRemotePort: UInt16 = 0
    private(set) var micPeak: Float = 0
    private(set) var rxPeak: Float = 0
    private(set) var startedAt: Date?
    private(set) var tapFormatDesc: String = "RemoteIO I16 8000Hz ch=1"
    private(set) var converterFormatDesc: String = "n/a (RemoteIO native 8kHz)"
    private(set) var converterRebuilds: Int = 0
    private(set) var convertErrors: Int = 0
    private(set) var lastConvertError: String = ""
    private var inputCallbackCount: UInt64 = 0
    private var renderCallbackCount: UInt64 = 0
    private var inputFramesTotal: UInt64 = 0
    private var renderFramesTotal: UInt64 = 0

    func snapshot() -> [String: Any] {
        return [
            "running": running,
            "localIp": localIp,
            "localPort": Int(localPort),
            "remoteIp": hasRemote ? String(cString: inet_ntoa(remoteAddr.sin_addr)) : "",
            "remotePort": Int(lastRemotePort),
            "txPackets": Int(txPackets),
            "rxPackets": Int(rxPackets),
            "txBytes": Int(txBytes),
            "rxBytes": Int(rxBytes),
            "lastSeq": Int(lastRemoteSeq),
            "seqOut": Int(sequenceNumber),
            "micPeak": micPeak,
            "rxPeak": rxPeak,
            "uptimeMs": startedAt.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0,
            "route": currentRouteDescription(),
            "tapFormat": tapFormatDesc,
            "converterFormat": converterFormatDesc,
            "converterRebuilds": converterRebuilds,
            "convertErrors": convertErrors,
            "lastConvertError": lastConvertError,
            "engineRestartAttempts": engineRestartAttempts,
            "engineRestartTotal": engineRestartTotal,
            "lastEngineError": lastEngineError,
            "sessionState": sessionStateDescription(),
            "audioBackend": "VoiceProcessingIO (AEC/NS/AGC)",
            "inputCallbacks": Int(inputCallbackCount),
            "renderCallbacks": Int(renderCallbackCount),
            "inputFrames": Int(inputFramesTotal),
            "renderFrames": Int(renderFramesTotal)
        ]
    }

    private func sessionStateDescription() -> String {
        let s = AVAudioSession.sharedInstance()
        let cat = s.category.rawValue
        let mode = s.mode.rawValue
        let opts = s.categoryOptions.rawValue
        let sr = s.sampleRate
        let io = s.ioBufferDuration * 1000
        return "cat=\(cat) mode=\(mode) opts=0x\(String(opts, radix: 16)) sr=\(Int(sr)) io=\(Int(io))ms"
    }

    private func logSessionState(_ tag: String) {
        NSLog("[RTP] session[\(tag)] \(sessionStateDescription()) route=\(currentRouteDescription())")
    }

    // MARK: - Lifecycle
    func prepareLocalSocket() throws {
        localIp = RTPAudioSession.primaryLocalIPv4() ?? "0.0.0.0"
        let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        if fd < 0 { throw err("socket() failed: \(String(cString: strerror(errno)))") }
        var yes: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &yes, socklen_t(MemoryLayout<Int32>.size))

        var bound: UInt16 = 0
        for _ in 0..<25 {
            let candidate = UInt16.random(in: 20000...30000) & 0xFFFE
            var addr = sockaddr_in()
            addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
            addr.sin_family = sa_family_t(AF_INET)
            addr.sin_port = in_port_t(candidate.bigEndian)
            addr.sin_addr = in_addr(s_addr: INADDR_ANY)
            let res = withUnsafePointer(to: &addr) { ptr -> Int32 in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                    Darwin.bind(fd, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
                }
            }
            if res == 0 { bound = candidate; break }
        }
        if bound == 0 {
            close(fd)
            throw err("Failed to bind UDP socket in [20000,30000]")
        }
        self.sockfd = fd
        self.localPort = bound
        NSLog("[RTP] bound UDP fd=\(fd) port=\(bound) ip=\(localIp)")
    }

    func start(remoteIp: String, remotePort: UInt16) {
        guard !running else { return }
        guard sockfd >= 0 else { NSLog("[RTP] start without socket"); return }
        running = true
        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(remotePort.bigEndian)
        addr.sin_addr.s_addr = inet_addr(remoteIp)
        self.remoteAddr = addr
        self.hasRemote = true
        self.lastRemotePort = remotePort
        self.startedAt = Date()
        NSLog("[RTP] start remote=\(remoteIp):\(remotePort) local=\(localIp):\(localPort)")
        startReceiveLoop()
        if ioUnit == nil {
            startAudio()
        } else {
            NSLog("[RTP] start: RemoteIO already prewarmed — reusing existing AudioUnit")
            emitAudio("running")
        }
    }

    /// Public: build + start RemoteIO eagerly (called right after socket bind).
    /// Doing this BEFORE the SIP INVITE avoids AudioUnitInitialize 561017449
    /// caused by AVAudioSession being mid-config when the call answers.
    func prewarmAudio() {
        if audioPrepared && ioUnit != nil { return }
        audioPrepared = true
        startAudio()
    }

    /// Play a local 440Hz tone for ~seconds seconds through the speaker path
    /// by feeding sine samples into the RemoteIO playback queue.
    func playTestTone(seconds: Double = 1.5, frequency: Double = 440) {
        if ioUnit == nil {
            configureSessionCategory()
            _ = buildAndStartIOUnit()
        }
        // Tone is generated at the RTP/playQueue rate (8kHz); render callback
        // upsamples to the hardware rate.
        let total = Int(rtpSampleRate * seconds)
        var samples = [Int16](repeating: 0, count: total)
        let twoPi = 2.0 * Double.pi
        for i in 0..<total {
            let v = sin(twoPi * frequency * Double(i) / rtpSampleRate) * 8000
            samples[i] = Int16(v)
        }
        audioLock.lock()
        playQueue.append(contentsOf: samples)
        if playQueue.count > maxPlayQueueSamples * 2 {
            playQueue.removeFirst(playQueue.count - maxPlayQueueSamples * 2)
        }
        audioLock.unlock()
    }

    func stop() {
        let wasRunning = running
        running = false
        audioPrepared = false
        NSLog("[RTP] stop")
        engineRestartTimer?.cancel(); engineRestartTimer = nil
        engineRestartAttempts = 0
        removeAudioObservers()
        teardownIOUnit()
        if sockfd >= 0 { close(sockfd); sockfd = -1 }
        audioLock.lock()
        sendBuffer.removeAll()
        playQueue.removeAll()
        audioLock.unlock()
        hasRemote = false
        if wasRunning { emitAudio("idle") }
    }

    func setMuted(_ muted: Bool) { isMuted = muted }

    // MARK: - Audio start
    private func startAudio() {
        emitAudio("starting")
        logSessionState("pre-start")
        installAudioObservers()
        configureSessionCategory()
        // Let the session settle before reading/forcing hardware format.
        NSLog("[RTP] sleeping 100ms after setCategory to let session settle")
        Thread.sleep(forTimeInterval: 0.1)
        // hwSampleRate is PINNED to 48000Hz. Do NOT read from AVAudioSession
        // here — it may return 0 mid-setup. We requested 48000 via
        // setPreferredSampleRate; if iOS gave us something else the resampler
        // still works (fractional phase accumulator), but RemoteIO is now
        // configured for 48000 which is universally supported.
        let actual = AVAudioSession.sharedInstance().sampleRate
        tapFormatDesc = "RemoteIO I16 \(Int(hwSampleRate))Hz ch=1 → RTP 8000Hz (session=\(Int(actual))Hz)"
        NSLog("[RTP] hwSampleRate=\(Int(hwSampleRate))Hz pinned (session reports \(Int(actual))Hz, RTP=\(Int(rtpSampleRate))Hz)")
        logSessionState("post-settle")
        if buildAndStartIOUnit() {
            engineRestartAttempts = 0
            emitAudio("running")
        } else {
            emitAudio("retrying")
            scheduleEngineRestart()
        }
    }

    private static let voipSessionOptions: AVAudioSession.CategoryOptions = [
        .allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker, .duckOthers
    ]

    private func configureSessionCategory() {
        let session = AVAudioSession.sharedInstance()
        // CapacitorSip owns setActive(true). We only (re)assert category.
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat,
                                    options: RTPAudioSession.voipSessionOptions)
            NSLog("[RTP] setCategory playAndRecord/voiceChat ok (skip setActive — owned by SIP)")
        } catch {
            NSLog("[RTP] setCategory failed: \(error.localizedDescription)")
        }
        // Hint preferred I/O parameters; iOS may pick its own hardware rate.
        try? session.setPreferredSampleRate(hwSampleRate)
        try? session.setPreferredIOBufferDuration(0.02)
        logSessionState("post-category")
    }

    // MARK: - RemoteIO build / teardown
    @discardableResult
    private func buildAndStartIOUnit() -> Bool {
        if ioUnit != nil { NSLog("[RTP] RemoteIO already built — reusing"); return true }
        NSLog("[RTP] RemoteIO build begin (hwSampleRate=\(Int(hwSampleRate))Hz)")
        // Reset resampler phase for a clean start.
        txPhase = 0; rxPhase = 0; rxHoldSample = 0

        // Phase 4: use VoiceProcessingIO instead of plain RemoteIO to get
        // built-in AEC (echo cancellation), NS (noise suppression) and AGC
        // (auto gain) handled by the OS Voice Processing unit.
        var desc = AudioComponentDescription(
            componentType: kAudioUnitType_Output,
            componentSubType: kAudioUnitSubType_VoiceProcessingIO,
            componentManufacturer: kAudioUnitManufacturer_Apple,
            componentFlags: 0, componentFlagsMask: 0
        )
        guard let comp = AudioComponentFindNext(nil, &desc) else {
            lastEngineError = "AudioComponentFindNext returned nil"
            NSLog("[RTP] \(lastEngineError)")
            return false
        }
        NSLog("[RTP] RemoteIO component found")
        var unit: AudioUnit?
        var status = AudioComponentInstanceNew(comp, &unit)
        if status != noErr || unit == nil {
            lastEngineError = "AudioComponentInstanceNew failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            return false
        }
        let io = unit!
        NSLog("[RTP] RemoteIO instance created")

        // Enable input on element 1 (mic).
        var enable: UInt32 = 1
        status = AudioUnitSetProperty(io, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Input, 1,
                                      &enable, UInt32(MemoryLayout<UInt32>.size))
        if status != noErr {
            lastEngineError = "enableIO(input) failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] RemoteIO input enabled bus=1")
        // Output on element 0 is enabled by default but assert it.
        status = AudioUnitSetProperty(io, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Output, 0,
                                      &enable, UInt32(MemoryLayout<UInt32>.size))
        if status != noErr {
            NSLog("[RTP] enableIO(output) status=\(describeOSStatus(status)) (continuing)")
        } else {
            NSLog("[RTP] RemoteIO output enabled bus=0")
        }

        // Stream format: 8kHz mono Int16 packed.
        var asbd = AudioStreamBasicDescription(
            mSampleRate: hwSampleRate,
            mFormatID: kAudioFormatLinearPCM,
            mFormatFlags: kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked,
            mBytesPerPacket: 2,
            mFramesPerPacket: 1,
            mBytesPerFrame: 2,
            mChannelsPerFrame: channels,
            mBitsPerChannel: 16,
            mReserved: 0
        )

        // Format the AU delivers to us when we render input (element 1, output scope).
        status = AudioUnitSetProperty(io, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Output, 1,
                                      &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        if status != noErr {
            lastEngineError = "setStreamFormat(input bus) failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] RemoteIO input callback format=I16 \(Int(hwSampleRate))Hz ch=1")
        // Format we feed to speaker (element 0, input scope).
        status = AudioUnitSetProperty(io, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Input, 0,
                                      &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        if status != noErr {
            lastEngineError = "setStreamFormat(output bus) failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] RemoteIO render format=I16 \(Int(hwSampleRate))Hz ch=1")

        let refcon = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())

        // Render callback on output (element 0, input scope) — pulls playback PCM.
        var renderCb = AURenderCallbackStruct(inputProc: rtp_render_cb, inputProcRefCon: refcon)
        status = AudioUnitSetProperty(io, kAudioUnitProperty_SetRenderCallback,
                                      kAudioUnitScope_Input, 0,
                                      &renderCb, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        if status != noErr {
            lastEngineError = "setRenderCallback failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] RemoteIO render callback installed bus=0")
        // Input callback on element 1 (global scope) — fires when mic samples ready.
        var inputCb = AURenderCallbackStruct(inputProc: rtp_input_cb, inputProcRefCon: refcon)
        status = AudioUnitSetProperty(io, kAudioOutputUnitProperty_SetInputCallback,
                                      kAudioUnitScope_Global, 1,
                                      &inputCb, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        if status != noErr {
            lastEngineError = "setInputCallback failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] RemoteIO input callback installed bus=1")

        // Phase 4: configure VoiceProcessingIO — enable AEC (not bypassed),
        // automatic gain control and ducking. Apple NS is always on with VPIO.
        var bypass: UInt32 = 0
        _ = AudioUnitSetProperty(io, kAUVoiceIOProperty_BypassVoiceProcessing,
                                 kAudioUnitScope_Global, 0,
                                 &bypass, UInt32(MemoryLayout<UInt32>.size))
        var agc: UInt32 = 1
        _ = AudioUnitSetProperty(io, kAUVoiceIOProperty_VoiceProcessingEnableAGC,
                                 kAudioUnitScope_Global, 0,
                                 &agc, UInt32(MemoryLayout<UInt32>.size))
        var muteOut: UInt32 = 0
        _ = AudioUnitSetProperty(io, kAUVoiceIOProperty_MuteOutput,
                                 kAudioUnitScope_Global, 0,
                                 &muteOut, UInt32(MemoryLayout<UInt32>.size))
        NSLog("[RTP] VoiceProcessingIO configured: AEC=on NS=on AGC=on")

        NSLog("[RTP] AudioUnitInitialize begin")
        status = AudioUnitInitialize(io)
        if status != noErr {
            lastEngineError = "AudioUnitInitialize failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioComponentInstanceDispose(io); return false
        }
        NSLog("[RTP] AudioUnitInitialize ok")
        NSLog("[RTP] AudioOutputUnitStart begin")
        status = AudioOutputUnitStart(io)
        if status != noErr {
            lastEngineError = "AudioOutputUnitStart failed: \(describeOSStatus(status))"
            NSLog("[RTP] \(lastEngineError)")
            AudioUnitUninitialize(io)
            AudioComponentInstanceDispose(io)
            return false
        }
        self.ioUnit = io
        self.lastEngineError = ""
        NSLog("[RTP] RemoteIO started, route=\(currentRouteDescription())")
        logSessionState("audiounit-running")
        return true
    }

    private func teardownIOUnit() {
        if let io = ioUnit {
            NSLog("[RTP] RemoteIO stopping")
            let stopStatus = AudioOutputUnitStop(io)
            if stopStatus != noErr { NSLog("[RTP] AudioOutputUnitStop status=\(describeOSStatus(stopStatus))") }
            let uninitStatus = AudioUnitUninitialize(io)
            if uninitStatus != noErr { NSLog("[RTP] AudioUnitUninitialize status=\(describeOSStatus(uninitStatus))") }
            let disposeStatus = AudioComponentInstanceDispose(io)
            if disposeStatus != noErr { NSLog("[RTP] AudioComponentInstanceDispose status=\(describeOSStatus(disposeStatus))") }
            ioUnit = nil
            NSLog("[RTP] RemoteIO disposed")
        }
        if let p = captureScratch {
            p.deallocate()
            captureScratch = nil
            captureScratchFrames = 0
        }
    }

    /// Exponential backoff (0.5s … 10s, 8 attempts).
    private func scheduleEngineRestart() {
        guard running else { return }
        engineRestartAttempts += 1
        if engineRestartAttempts > 8 {
            NSLog("[RTP] RemoteIO restart abandoned after \(engineRestartAttempts) attempts")
            emitAudio("error", ["reason": "RemoteIO restart abandoned: \(lastEngineError)"])
            return
        }
        emitAudio("retrying", ["attempt": engineRestartAttempts])
        let delay = min(10.0, 0.5 * pow(2.0, Double(engineRestartAttempts - 1)))
        NSLog("[RTP] scheduling RemoteIO restart #\(engineRestartAttempts) in \(delay)s")
        engineRestartTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .userInitiated))
        timer.schedule(deadline: .now() + delay)
        timer.setEventHandler { [weak self] in self?.performEngineRestart() }
        engineRestartTimer = timer
        timer.resume()
    }

    private func performEngineRestart() {
        guard running else { return }
        engineRestartTotal += 1
        NSLog("[RTP] restarting RemoteIO (attempt #\(engineRestartAttempts), total=\(engineRestartTotal))")
        configureSessionCategory()
        Thread.sleep(forTimeInterval: 0.1)
        if buildAndStartIOUnit() {
            engineRestartAttempts = 0
            emitAudio("running")
        } else {
            scheduleEngineRestart()
        }
    }

    // MARK: - Audio system observers
    private func installAudioObservers() {
        removeAudioObservers()
        let nc = NotificationCenter.default
        routeChangeObserver = nc.addObserver(forName: AVAudioSession.routeChangeNotification,
                                             object: nil, queue: .main) { [weak self] note in
            guard let self = self else { return }
            let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 0
            NSLog("[RTP] routeChange reason=\(reason) route=\(self.currentRouteDescription())")
        }
        interruptionObserver = nc.addObserver(forName: AVAudioSession.interruptionNotification,
                                              object: nil, queue: .main) { [weak self] note in
            guard let self = self else { return }
            let typeRaw = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) ?? 0
            let type = AVAudioSession.InterruptionType(rawValue: typeRaw)
            NSLog("[RTP] interruption type=\(typeRaw)")
            if type == .ended, self.running {
                self.scheduleEngineRestart()
            }
        }
        mediaServicesResetObserver = nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                                                    object: nil, queue: .main) { [weak self] _ in
            guard let self = self, self.running else { return }
            NSLog("[RTP] mediaServicesWereReset — full RemoteIO rebuild")
            self.teardownIOUnit()
            self.scheduleEngineRestart()
        }
    }

    private func removeAudioObservers() {
        let nc = NotificationCenter.default
        if let o = routeChangeObserver { nc.removeObserver(o); routeChangeObserver = nil }
        if let o = interruptionObserver { nc.removeObserver(o); interruptionObserver = nil }
        if let o = mediaServicesResetObserver { nc.removeObserver(o); mediaServicesResetObserver = nil }
    }

    // MARK: - Callback implementations (called from real-time audio thread)
    fileprivate func handleInputCallback(ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                                         inTimeStamp: UnsafePointer<AudioTimeStamp>,
                                         inBusNumber: UInt32,
                                         inNumberFrames: UInt32) -> OSStatus {
        guard let io = ioUnit else { return noErr }
        inputCallbackCount &+= 1
        inputFramesTotal &+= UInt64(inNumberFrames)

        // (Re)allocate scratch buffer to hold inNumberFrames Int16 mono samples.
        if captureScratch == nil || captureScratchFrames < inNumberFrames {
            if let p = captureScratch { p.deallocate() }
            captureScratch = UnsafeMutablePointer<Int16>.allocate(capacity: Int(inNumberFrames))
            captureScratchFrames = inNumberFrames
            NSLog("[RTP] input scratch allocated frames=\(inNumberFrames)")
        }
        let scratch = captureScratch!

        var abl = AudioBufferList(
            mNumberBuffers: 1,
            mBuffers: AudioBuffer(
                mNumberChannels: channels,
                mDataByteSize: inNumberFrames * 2,
                mData: UnsafeMutableRawPointer(scratch)
            )
        )
        let status = AudioUnitRender(io, ioActionFlags, inTimeStamp, inBusNumber, inNumberFrames, &abl)
        if status != noErr {
            if inputCallbackCount <= 5 || inputCallbackCount % 50 == 0 {
                NSLog("[RTP] input callback AudioUnitRender failed status=\(describeOSStatus(status)) bus=\(inBusNumber) frames=\(inNumberFrames)")
            }
            return status
        }

        let n = Int(inNumberFrames)
        var peak: Int16 = 0
        for i in 0..<n { let a = abs(scratch[i]); if a > peak { peak = a } }
        micPeak = Float(peak) / 32767.0

        // 48000 → 8000 downsample using 6-sample averaging (better SNR than
        // sample-and-hold decimation). Accumulator carries the partial window
        // across callbacks so we never lose alignment.
        var framesToSend: [[Int16]] = []
        audioLock.lock()
        if isMuted {
            // Push silence at 8k rate.
            let outCount = (downsampleAccum.count + n) / decimation
            sendBuffer.append(contentsOf: [Int16](repeating: 0, count: outCount))
            downsampleAccum.removeAll(keepingCapacity: true)
        } else {
            downsampleAccum.reserveCapacity(downsampleAccum.count + n)
            for i in 0..<n { downsampleAccum.append(scratch[i]) }
            var consumed = 0
            while consumed + decimation <= downsampleAccum.count {
                var sum: Int32 = 0
                for j in 0..<decimation { sum &+= Int32(downsampleAccum[consumed + j]) }
                let avg = sum / Int32(decimation)
                let clamped = max(Int32(Int16.min), min(Int32(Int16.max), avg))
                sendBuffer.append(Int16(clamped))
                consumed += decimation
            }
            if consumed > 0 { downsampleAccum.removeFirst(consumed) }
        }
        while sendBuffer.count >= frameSamples {
            let frame = Array(sendBuffer.prefix(frameSamples))
            sendBuffer.removeFirst(frameSamples)
            framesToSend.append(frame)
        }
        let queued = sendBuffer.count
        audioLock.unlock()

        for f in framesToSend { sendRTPFrame(f) }
        if inputCallbackCount == 1 || inputCallbackCount % 50 == 0 {
            NSLog("[RTP] input cb #\(inputCallbackCount) hwFrames=\(n) decim=\(decimated.count) micPeak=\(String(format: "%.3f", micPeak)) queued=\(queued) txPackets=\(txPackets)")
        }
        return noErr
    }

    fileprivate func handleRenderCallback(ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                                          inTimeStamp: UnsafePointer<AudioTimeStamp>,
                                          inBusNumber: UInt32,
                                          inNumberFrames: UInt32,
                                          ioData: UnsafeMutablePointer<AudioBufferList>?) -> OSStatus {
        guard let ioData = ioData else { return noErr }
        renderCallbackCount &+= 1
        renderFramesTotal &+= UInt64(inNumberFrames)
        let abl = UnsafeMutableAudioBufferListPointer(ioData)
        let needed = Int(inNumberFrames)

        // Integer upsample 8000 → 48000 (sample-and-hold, repeat each x6).
        // rxPhase carries the remaining repeat count for the held sample
        // across callbacks so hwFrames boundaries don't cause clicks.
        var out = [Int16](repeating: 0, count: needed)
        var hold = rxHoldSample
        var repeatsLeft = Int(rxPhase)
        var drained = 0
        audioLock.lock()
        let available = playQueue.count
        for i in 0..<needed {
            if repeatsLeft == 0 {
                if !playQueue.isEmpty {
                    hold = playQueue.removeFirst()
                    drained += 1
                } else {
                    hold = 0
                }
                repeatsLeft = decimation
            }
            out[i] = hold
            repeatsLeft -= 1
        }
        rxPhase = Double(repeatsLeft)
        rxHoldSample = hold
        let remaining = playQueue.count
        audioLock.unlock()

        for buffer in abl {
            guard let data = buffer.mData else { continue }
            let dst = data.assumingMemoryBound(to: Int16.self)
            out.withUnsafeBufferPointer { src in
                dst.update(from: src.baseAddress!, count: needed)
            }
        }
        if renderCallbackCount == 1 || renderCallbackCount % 50 == 0 {
            NSLog("[RTP] render cb #\(renderCallbackCount) hwFrames=\(needed) drained8k=\(drained) avail8k=\(available)→\(remaining) rxPackets=\(rxPackets) rxPeak=\(String(format: "%.3f", rxPeak))")
        }
        return noErr
    }

    // MARK: - RTP send
    private func sendRTPFrame(_ samples: [Int16]) {
        guard hasRemote, sockfd >= 0 else { return }
        var packet = Data(capacity: 12 + samples.count)
        packet.append(0x80)
        packet.append(0x00) // PT=0 PCMU
        packet.append(UInt8((sequenceNumber >> 8) & 0xFF))
        packet.append(UInt8(sequenceNumber & 0xFF))
        let ts = timestamp
        packet.append(UInt8((ts >> 24) & 0xFF))
        packet.append(UInt8((ts >> 16) & 0xFF))
        packet.append(UInt8((ts >> 8) & 0xFF))
        packet.append(UInt8(ts & 0xFF))
        packet.append(UInt8((ssrc >> 24) & 0xFF))
        packet.append(UInt8((ssrc >> 16) & 0xFF))
        packet.append(UInt8((ssrc >> 8) & 0xFF))
        packet.append(UInt8(ssrc & 0xFF))
        for s in samples { packet.append(RTPAudioSession.linearToUlaw(s)) }
        sequenceNumber = sequenceNumber &+ 1
        timestamp = timestamp &+ UInt32(samples.count)

        let fd = sockfd
        var addr = remoteAddr
        let pktLen = packet.count
        txQueue.async {
            packet.withUnsafeBytes { raw in
                _ = withUnsafePointer(to: &addr) { ptr in
                    ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                        Darwin.sendto(fd, raw.baseAddress, pktLen, 0, sa,
                                      socklen_t(MemoryLayout<sockaddr_in>.size))
                    }
                }
            }
        }
        txPackets &+= 1
        txBytes &+= UInt64(pktLen)
    }

    // MARK: - RTP receive
    private func startReceiveLoop() {
        let fd = sockfd
        rxQueue.async { [weak self] in
            var buf = [UInt8](repeating: 0, count: 2048)
            var from = sockaddr_in()
            var fromLen = socklen_t(MemoryLayout<sockaddr_in>.size)
            while let self = self, self.running, fd >= 0 {
                let n = buf.withUnsafeMutableBufferPointer { mb -> Int in
                    withUnsafeMutablePointer(to: &from) { fp in
                        fp.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                            Darwin.recvfrom(fd, mb.baseAddress, mb.count, 0, sa, &fromLen)
                        }
                    }
                }
                if n <= 12 { continue }
                if from.sin_port != self.remoteAddr.sin_port {
                    self.remoteAddr.sin_port = from.sin_port
                    self.lastRemotePort = UInt16(bigEndian: from.sin_port)
                    NSLog("[RTP] latched remote port=\(self.lastRemotePort)")
                }
                self.rxPackets &+= 1
                self.rxBytes &+= UInt64(n)
                self.lastRemoteSeq = (UInt16(buf[2]) << 8) | UInt16(buf[3])
                let payloadCount = n - 12
                var samples = [Int16](); samples.reserveCapacity(payloadCount)
                var peak: Int16 = 0
                for i in 0..<payloadCount {
                    let s = RTPAudioSession.ulawToLinear(buf[12 + i])
                    let a = s < 0 ? -s : s
                    if a > peak { peak = a }
                    samples.append(s)
                }
                self.rxPeak = Float(peak) / 32767.0
                self.audioLock.lock()
                self.playQueue.append(contentsOf: samples)
                if self.playQueue.count > self.maxPlayQueueSamples {
                    let drop = self.playQueue.count - self.maxPlayQueueSamples
                    self.playQueue.removeFirst(drop)
                }
                self.audioLock.unlock()
                if self.rxPackets == 1 || self.rxPackets % 50 == 0 {
                    NSLog("[RTP] rx packet #\(self.rxPackets) bytes=\(n) payload=\(payloadCount) seq=\(self.lastRemoteSeq) rxPeak=\(String(format: "%.3f", self.rxPeak)) playQueue=\(self.playQueue.count)")
                }
            }
            NSLog("[RTP] receive loop exited")
        }
    }

    // MARK: - μ-law
    static func linearToUlaw(_ pcm: Int16) -> UInt8 {
        let BIAS: Int32 = 0x84
        let CLIP: Int32 = 32635
        var sample = Int32(pcm)
        let sign: Int32 = sample < 0 ? 0x7F : 0xFF
        if sample < 0 { sample = -sample }
        if sample > CLIP { sample = CLIP }
        sample += BIAS
        var exponent: Int32 = 7
        var expMask: Int32 = 0x4000
        while (sample & expMask) == 0 && exponent > 0 { exponent -= 1; expMask >>= 1 }
        let mantissa = (sample >> (exponent + 3)) & 0x0F
        let ulaw = ~(sign & ((exponent << 4) | mantissa)) & 0xFF
        return UInt8(ulaw & 0xFF)
    }

    static func ulawToLinear(_ u: UInt8) -> Int16 {
        let inv = ~u
        let sign = inv & 0x80
        let exponent = Int32((inv >> 4) & 0x07)
        let mantissa = Int32(inv & 0x0F)
        var sample: Int32 = ((mantissa << 3) + 0x84) << exponent
        sample -= 0x84
        return Int16(sign != 0 ? -sample : sample)
    }

    // MARK: - Helpers
    private func err(_ m: String) -> NSError {
        NSError(domain: "RTPAudioSession", code: 1, userInfo: [NSLocalizedDescriptionKey: m])
    }

    private func describeOSStatus(_ status: OSStatus) -> String {
        if status == noErr { return "0/noErr" }
        let unsigned = UInt32(bitPattern: status)
        let bytes: [UInt8] = [
            UInt8((unsigned >> 24) & 0xff),
            UInt8((unsigned >> 16) & 0xff),
            UInt8((unsigned >> 8) & 0xff),
            UInt8(unsigned & 0xff)
        ]
        let printable = bytes.allSatisfy { $0 >= 32 && $0 <= 126 }
        let fourCC = printable ? String(bytes: bytes, encoding: .macOSRoman) ?? "" : ""
        return fourCC.isEmpty ? "\(status)" : "\(status) ('\(fourCC)')"
    }

    private func currentRouteDescription() -> String {
        let out = AVAudioSession.sharedInstance().currentRoute.outputs.map { "\($0.portType.rawValue):\($0.portName)" }
        return out.joined(separator: ",")
    }

    static func primaryLocalIPv4() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let flags = Int32(p.pointee.ifa_flags)
            let addr = p.pointee.ifa_addr.pointee
            if (flags & (IFF_UP|IFF_RUNNING)) == (IFF_UP|IFF_RUNNING),
               (flags & IFF_LOOPBACK) == 0,
               addr.sa_family == UInt8(AF_INET) {
                let name = String(cString: p.pointee.ifa_name)
                if name == "en0" || name == "en1" || name == "pdp_ip0" {
                    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    if getnameinfo(p.pointee.ifa_addr, socklen_t(p.pointee.ifa_addr.pointee.sa_len),
                                   &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                        address = String(cString: host)
                        if name == "en0" { return address }
                    }
                }
            }
            ptr = p.pointee.ifa_next
        }
        return address
    }
}

// MARK: - C trampolines (must be free @convention(c) functions)
private func rtp_input_cb(inRefCon: UnsafeMutableRawPointer,
                          ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                          inTimeStamp: UnsafePointer<AudioTimeStamp>,
                          inBusNumber: UInt32,
                          inNumberFrames: UInt32,
                          ioData: UnsafeMutablePointer<AudioBufferList>?) -> OSStatus {
    let session = Unmanaged<RTPAudioSession>.fromOpaque(inRefCon).takeUnretainedValue()
    return session.handleInputCallback(ioActionFlags: ioActionFlags,
                                       inTimeStamp: inTimeStamp,
                                       inBusNumber: inBusNumber,
                                       inNumberFrames: inNumberFrames)
}

private func rtp_render_cb(inRefCon: UnsafeMutableRawPointer,
                           ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                           inTimeStamp: UnsafePointer<AudioTimeStamp>,
                           inBusNumber: UInt32,
                           inNumberFrames: UInt32,
                           ioData: UnsafeMutablePointer<AudioBufferList>?) -> OSStatus {
    let session = Unmanaged<RTPAudioSession>.fromOpaque(inRefCon).takeUnretainedValue()
    return session.handleRenderCallback(ioActionFlags: ioActionFlags,
                                        inTimeStamp: inTimeStamp,
                                        inBusNumber: inBusNumber,
                                        inNumberFrames: inNumberFrames,
                                        ioData: ioData)
}
