import Foundation
import Network
import AVFoundation
import Darwin

/// Minimal PCMU (G.711 μ-law) RTP audio session.
/// - UDP socket bound to a random port in [20000, 30000].
/// - Captures mic with AVAudioEngine, downsamples to 8 kHz mono Int16,
///   encodes μ-law, sends RTP every 20 ms (160 samples per packet).
/// - Receives RTP, decodes μ-law, plays via an AVAudioPlayerNode at 8 kHz.
final class RTPAudioSession {
    // MARK: - Public state
    private(set) var localPort: UInt16 = 0
    private(set) var localIp: String = "0.0.0.0"

    // MARK: - Private state
    private var listener: NWListener?
    private var sendConnection: NWConnection?
    private let netQueue = DispatchQueue(label: "rtp.audio.net")
    private var remoteHost: NWEndpoint.Host?
    private var remotePort: NWEndpoint.Port?

    private let engine = AVAudioEngine()
    private var playerNode = AVAudioPlayerNode()
    private let playFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                           sampleRate: 8000,
                                           channels: 1,
                                           interleaved: true)!
    private var converter: AVAudioConverter?

    private var sequenceNumber: UInt16 = UInt16.random(in: 0...UInt16.max)
    private var timestamp: UInt32 = UInt32.random(in: 0...UInt32.max)
    private let ssrc: UInt32 = UInt32.random(in: 0...UInt32.max)

    private var sendBuffer = [Int16]()
    private let frameSamples = 160 // 20ms at 8kHz
    private var isMuted = false
    private var running = false

    // MARK: - Lifecycle
    /// Bind the UDP socket and discover local IP. Call before generating SDP.
    func prepareLocalSocket() throws {
        localIp = RTPAudioSession.primaryLocalIPv4() ?? "0.0.0.0"
        for _ in 0..<20 {
            let candidate = UInt16.random(in: 20000...30000) & 0xFFFE // even port
            if let p = NWEndpoint.Port(rawValue: candidate),
               let l = try? NWListener(using: .udp, on: p) {
                self.listener = l
                self.localPort = candidate
                l.newConnectionHandler = { [weak self] conn in self?.acceptIncoming(conn) }
                l.stateUpdateHandler = { state in NSLog("[RTP] listener state=\(state)") }
                l.start(queue: netQueue)
                NSLog("[RTP] bound UDP port=\(candidate) ip=\(localIp)")
                return
            }
        }
        throw NSError(domain: "RTPAudioSession", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Failed to bind UDP socket"])
    }

    /// Set the remote RTP endpoint then start capture + playback.
    func start(remoteIp: String, remotePort: UInt16) {
        guard !running else { return }
        running = true
        self.remoteHost = NWEndpoint.Host(remoteIp)
        self.remotePort = NWEndpoint.Port(rawValue: remotePort)
        NSLog("[RTP] start remote=\(remoteIp):\(remotePort)")

        // Outbound connection (we already listen on the same local port for inbound).
        if let host = remoteHost, let rp = remotePort {
            let params = NWParameters.udp
            // Reuse local port so symmetric RTP works.
            if let lp = NWEndpoint.Port(rawValue: localPort) {
                params.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(.any), port: lp)
            }
            let conn = NWConnection(host: host, port: rp, using: params)
            conn.stateUpdateHandler = { s in NSLog("[RTP] send conn state=\(s)") }
            conn.start(queue: netQueue)
            self.sendConnection = conn
            _ = rp
        }

        startAudio()
    }

    func stop() {
        guard running else { return }
        running = false
        NSLog("[RTP] stop")
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        playerNode.stop()
        sendConnection?.cancel(); sendConnection = nil
        listener?.cancel(); listener = nil
        sendBuffer.removeAll()
    }

    func setMuted(_ muted: Bool) { isMuted = muted }

    // MARK: - Audio
    private func startAudio() {
        let input = engine.inputNode
        let hwFormat = input.outputFormat(forBus: 0)
        NSLog("[RTP] hw input format sr=\(hwFormat.sampleRate) ch=\(hwFormat.channelCount)")

        guard let conv = AVAudioConverter(from: hwFormat, to: playFormat) else {
            NSLog("[RTP] cannot create converter"); return
        }
        self.converter = conv

        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: playFormat)

        input.installTap(onBus: 0, bufferSize: 1024, format: hwFormat) { [weak self] buf, _ in
            self?.handleCapturedBuffer(buf)
        }

        do {
            try engine.start()
            playerNode.play()
            NSLog("[RTP] audio engine started")
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

    // MARK: - RTP packetization
    private func sendRTPFrame(_ samples: [Int16]) {
        guard let conn = sendConnection else { return }
        var packet = Data(capacity: 12 + samples.count)
        // RTP header
        packet.append(0x80) // V=2
        packet.append(0x00) // PT=0 (PCMU)
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

        conn.send(content: packet, completion: .contentProcessed { err in
            if let err = err { NSLog("[RTP] send err: \(err.localizedDescription)") }
        })
    }

    // MARK: - Inbound RTP
    private func acceptIncoming(_ conn: NWConnection) {
        conn.start(queue: netQueue)
        receiveLoop(conn)
    }

    private func receiveLoop(_ conn: NWConnection) {
        conn.receiveMessage { [weak self] data, _, _, error in
            guard let self = self else { return }
            if let data = data, data.count > 12 {
                self.handleIncomingRTP(data)
            }
            if error == nil, self.running { self.receiveLoop(conn) }
        }
    }

    private func handleIncomingRTP(_ data: Data) {
        // Skip 12-byte header (no CSRC/extension handling for the common case).
        let payload = data.subdata(in: 12..<data.count)
        var samples = [Int16](); samples.reserveCapacity(payload.count)
        for b in payload { samples.append(RTPAudioSession.ulawToLinear(b)) }

        guard let pcm = AVAudioPCMBuffer(pcmFormat: playFormat, frameCapacity: AVAudioFrameCount(samples.count)) else { return }
        pcm.frameLength = AVAudioFrameCount(samples.count)
        if let dst = pcm.int16ChannelData?[0] {
            samples.withUnsafeBufferPointer { src in
                dst.update(from: src.baseAddress!, count: samples.count)
            }
        }
        playerNode.scheduleBuffer(pcm, completionHandler: nil)
    }

    // MARK: - G.711 μ-law
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

    // MARK: - Local IP helper
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
                        if name == "en0" { return address } // prefer Wi-Fi
                    }
                }
            }
            ptr = p.pointee.ifa_next
        }
        return address
    }
}
