require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "hightouch-events-sdk-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "11" }
  s.source       = { :git => "https://github.com/ht-sdks/events-sdk-react-native.git", :tag => "#{s.version}" }

  
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.header_dir     = 'hightouch-events-sdk-react-native'

  s.static_framework = true

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'USE_HEADERMAP' => 'YES',
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }
  s.user_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"${PODS_CONFIGURATION_BUILD_DIR}/hightouch-events-sdk-react-native/Swift Compatibility Header\"",
  }
  
  s.dependency "React-Core"
  s.dependency "ht-sovran-react-native"
end
