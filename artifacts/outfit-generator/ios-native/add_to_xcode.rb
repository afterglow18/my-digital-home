#!/usr/bin/env ruby
# add_to_xcode.rb — registers VisionPlugin.swift + VisionPlugin.m in the
# Xcode project so the native build includes them.
#
# Codemagic copies ios-native/*.swift / *.m into ios/App/App/ then runs:
#   ruby artifacts/outfit-generator/ios-native/add_to_xcode.rb
#
# Requires: gem 'xcodeproj' (pre-installed on Codemagic macOS machines)

require 'xcodeproj'

PROJECT_PATH = 'artifacts/outfit-generator/ios/App/App.xcodeproj'
TARGET_NAME  = 'App'
FILES        = %w[VisionPlugin.swift VisionPlugin.m]

project = Xcodeproj::Project.open(PROJECT_PATH)

target = project.targets.find { |t| t.name == TARGET_NAME }
abort "Target '#{TARGET_NAME}' not found in #{PROJECT_PATH}" unless target

# Locate (or create) the "App" source group
app_group = project.main_group.find_subpath(TARGET_NAME, true)

FILES.each do |file_name|
  # Skip if already registered
  next if app_group.files.any? { |f| f.path == file_name }

  ref = app_group.new_file(file_name)
  target.source_build_phase.add_file_reference(ref)
  puts "  + #{file_name}"
end

project.save
puts "Xcode project saved."
