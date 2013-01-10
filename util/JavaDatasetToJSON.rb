#!/usr/bin/ruby

require 'JSON'

if ARGV.length != 1 or !File.exists?(ARGV[0]) or File.directory?(ARGV[0])
  puts "Usage: #{$0} [old-data-file]"
  puts ""
  puts "Converts the CSV-style data file written for SticiGui into JSON to be"
  puts "used with the HTML5/Javascript rewrite of the interactive charts"
  puts "portion of SticiGui."
  puts ""
  puts "Output: $[old-data-file].json"
  exit
end

if File.exists?("#{ARGV[0]}.json") and !File.directory?("#{ARGV[0]}.json")
  puts "Output file #{ARGV[0]}.json already exists!"
  exit
end

json_lines = []
File.new(ARGV[0]).each do |line|
  line_vars = []
  quoted = false
  comment_only = false
  var = ""
  (0..line.length-1).each do |i|
    if var.empty? and line[i] == '"'
      quoted = true
      var = '//' if comment_only
    elsif quoted and line[i] == '"'
      line_vars.push(var)
      var = ''
      quoted = false
    elsif " \n\r\t".include? line[i]
      if quoted
        var += line[i]
      elsif var == '//'
        comment_only = true
        var = ''
      else
        line_vars.push(var) if !var.empty?
        var = ''
      end
    elsif var.empty? and comment_only
      var = '//' + line[i]
    else
      var += line[i]
    end
  end

  json_lines.push(line_vars)
end.close

out = File.open("#{ARGV[0]}.json", 'w')
out.write(JSON.dump(json_lines))
out.close
