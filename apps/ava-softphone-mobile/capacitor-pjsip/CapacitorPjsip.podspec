Pod::Spec.new do |s|
  s.name = 'CapacitorPjsip'
  s.version = '1.0.0'
  s.summary = 'SIP plugin for Capacitor'
  s.license = 'MIT'
  s.homepage = 'https://github.com/placeholder'
  s.author = 'AVA'
  s.source = { :path => '.' }
  s.source_files = 'CapacitorPjsip.m'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
end
