import Foundation
import AVFoundation
import Darwin

/// PCMU (G.711 μ-law) RTP audio session backed by a single BSD UDP socket
/// for symmetric send/receive. AVAudioEngine drives capture and playback.
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

    // MARK: - Audio
    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let playFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                           sampleRate: 8000,
                                           channels: 1,
                                           interleaved: true)!
    private var converter: AVAudioConverter?

    // MARK: - RTP
    private var sequenceNumber: UInt16 = UInt16.random(in: 0...UInt16.max)
    private var timestamp: UInt32 = UInt32.random(in: 0...UInt32.max)
    private let ssrc: UInt32 = UInt32.random(in: 0...UInt32.max)
    private var sendBuffer = [Int16]()
    private let frameSamples = 160 // 20ms @ 8kHz
    private var isMuted = false
    private var running = false

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
            "route": currentRouteDescription()
        ]
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
        startAudio()
    }

    /// Play a local 440Hz tone for `seconds` seconds through the speaker path
    /// (no RTP transmission). Used by the pre-call audio test screen.
    func playTestTone(seconds: Double = 1.5, frequency: Double = 440) {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .voiceChat,
                                 options: [.allowBluetooth, .allowBluetoothA2DP,
                                           .defaultToSpeaker, .duckOthers])
        try? session.setActive(true, options: [])
        if playerNode.engine == nil { engine.attach(playerNode) }
        engine.connect(playerNode, to: engine.mainMixerNode, format: playFormat)
        if !engine.isRunning { try? engine.start() }
        let frames = AVAudioFrameCount(playFormat.sampleRate * seconds)
        guard let buf = AVAudioPCMBuffer(pcmFormat: playFormat, frameCapacity: frames) else { return }
        buf.frameLength = frames
        if let ch = buf.int16ChannelData?[0] {
            let twoPi = 2.0 * Double.pi
            for i in 0..<Int(frames) {
                let s = sin(twoPi * frequency * Double(i) / playFormat.sampleRate) * 8000
                ch[i] = Int16(s)
            }
        }
        playerNode.scheduleBuffer(buf, completionHandler: nil)
        playerNode.play()
    }

    func stop() {
        guard running else { return }
        running = false
        NSLog("[RTP] stop")
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        playerNode.stop()
        if sockfd >= 0 { close(sockfd); sockfd = -1 }
        sendBuffer.removeAll()
        hasRemote = false
    }

    func setMuted(_ muted: Bool) { isMuted = muted }

    // MARK: - Audio engine
    private func startAudio() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat,
                                    options: [.allowBluetooth, .allowBluetoothA2DP,
                                              .defaultToSpeaker, .duckOthers])
            try session.setActive(true, options: [])
        } catch {
            NSLog("[RTP] audio session activate failed: \(error.localizedDescription)")
        }

        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: playFormat)
        engine.prepare()

        let input = engine.inputNode
        var hwFormat = input.outputFormat(forBus: 0)
        NSLog("[RTP] hw input sr=\(hwFormat.sampleRate) ch=\(hwFormat.channelCount)")
        if hwFormat.sampleRate <= 0 || hwFormat.channelCount == 0 {
            let sr = session.sampleRate > 0 ? session.sampleRate : 48000
            if let fb = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1) {
                hwFormat = fb
                NSLog("[RTP] fallback hw sr=\(sr) ch=1")
            } else {
                NSLog("[RTP] cannot derive hw format — aborting")
                return
            }
        }

        guard let conv = AVAudioConverter(from: hwFormat, to: playFormat) else {
            NSLog("[RTP] cannot create converter \(hwFormat) → \(playFormat)")
            return
        }
        self.converter = conv

        // Pass nil so CoreAudio uses the node's actual native format (avoids
        // "Failed to create tap due to format mismatch" when hw is 48k Float32
        // and our cached hwFormat is stale or different).
        input.installTap(onBus: 0, bufferSize: 1024, format: nil) { [weak self] buf, _ in
            self?.handleCapturedBuffer(buf)
        }

        do {
            try engine.start()
            playerNode.play()
            NSLog("[RTP] audio engine started, route=\(currentRouteDescription())")
        } catch {
            NSLog("[RTP] engine start failed: \(error.localizedDescription)")
        }
    }

    private func handleCapturedBuffer(_ buf: AVAudioPCMBuffer) {
        guard let conv = converter else { return }
        let ratio = playFormat.sampleRate / buf.format.sampleRate
        let outCapacity = AVAudioFrameCount(Double(buf.frameLength) * ratio + 16)
        guard let outBuf = AVAudioPCMBuffer(pcmFormat: playFormat, frameCapacity: outCapacity) else { return }

        var supplied = false
        var convErr: NSError?
        let status = conv.convert(to: outBuf, error: &convErr) { _, outStatus in
            if supplied { outStatus.pointee = .noDataNow; return nil }
            supplied = true
            outStatus.pointee = .haveData
            return buf
        }
        if status == .error || convErr != nil {
            NSLog("[RTP] convert error: \(convErr?.localizedDescription ?? "?")")
            return
        }
        guard let ptr = outBuf.int16ChannelData?[0] else { return }
        let n = Int(outBuf.frameLength)
        // Mic peak (linear 0..1) for diagnostics
        var peak: Int16 = 0
        for i in 0..<n { let a = abs(ptr[i]); if a > peak { peak = a } }
        micPeak = Float(peak) / 32767.0
        if isMuted {
            sendBuffer.append(contentsOf: repeatElement(0, count: n))
        } else {
            sendBuffer.append(contentsOf: UnsafeBufferPointer(start: ptr, count: n))
        }
        while sendBuffer.count >= frameSamples {
            let frame = Array(sendBuffer.prefix(frameSamples))
            sendBuffer.removeFirst(frameSamples)
            sendRTPFrame(frame)
        }
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
                // Symmetric RTP latch: if PBX answered from a different port, follow it.
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
                self.enqueuePlayback(samples)
            }
            NSLog("[RTP] receive loop exited")
        }
    }

    private func enqueuePlayback(_ samples: [Int16]) {
        guard let pcm = AVAudioPCMBuffer(pcmFormat: playFormat,
                                         frameCapacity: AVAudioFrameCount(samples.count)) else { return }
        pcm.frameLength = AVAudioFrameCount(samples.count)
        if let dst = pcm.int16ChannelData?[0] {
            samples.withUnsafeBufferPointer { src in
                dst.update(from: src.baseAddress!, count: samples.count)
            }
        }
        playerNode.scheduleBuffer(pcm, completionHandler: nil)
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
