#!/usr/bin/env ruby
require 'socket'
require 'csv'

# A very simple server that mocks the real device using a capture csv
# All paramters are specified in code below
PORT = 8844
PATH_TO_DATA = 'sample.csv'
DSI_STREAM_VERSION = "DSI-Streamer-v.0.7.34"
# Frequency as user's mains frequency (50 or 60Hz) and sensor sampling frequency (300,600, or 900 Hz)
FREQUENCY = "60,300"

# TODO: All packets are dumped without delay. once the proper delay tech is built we should enable this option

# Add a header to any packet
def gen_packet type, payload
  length = payload.size
  number = Thread.current[:number]
  Thread.current[:number] = number + 1
  "@ABCD" + [type,length,number].pack('CS>I>').force_encoding('UTF-8') + payload
end

#sending_node = headset? 1 : 0
HEADSET=1
NOT_APPLICABLE=0
def gen_event_packet event_code, sending_node, message=nil
  message_length = message.nil? ? 0 : message.size # TODO: Verify messages are not null terminated
  payload = [event_code,sending_node,message_length,message].pack('I>I>I>').force_encoding('UTF-8')
  gen_packet(5, payload)
end

def gen_dummy_packet
  gen_event_packet(5,HEADSET,"blahblah")
end

def greet client
  client.puts(gen_event_packet(1,NOT_APPLICABLE,DSI_STREAM_VERSION))
end

def send_intro client
  # montage # TODO: Implement the sensor map
  client.puts(gen_dummy_packet)
  # data rate
  client.puts(gen_event_packet(10,HEADSET,FREQUENCY))
  # Data start
  client.puts(gen_event_packet(2,HEADSET))
end

def send_stop client
  # Data stop
  client.puts(gen_event_packet(3,HEADSET))
end

def parse_data_as_bytes
  nchannels = 24
  header = false
  CSV.foreach(PATH_TO_DATA) do |row|
    next if row[0] =~ /#/
    if !header
      header = true
      next
    end
    reading = row

    timestamp = reading[0].to_f
    adc_status = [0,0,0,0,0,0] # sample data only
    channel_data = []
    nchannels.times { |i| channel_data[i] =  reading[i+1].to_f }

    trigger_value = reading[nchannels+1].to_f # -1 + 1 + 1
    bytes_to_send = [timestamp,0,*adc_status,*channel_data,trigger_value].pack('gC CCCCCC '+channel_data.size.times.collect{"g"}.join+"g").force_encoding('UTF-8')

    # Time offset, adc_status, and adc_sequence number currently ignored

    yield bytes_to_send
  end
end

def stream_data client
  parse_data_as_bytes { |bytes_to_send| client.puts(gen_packet(1, bytes_to_send)) }
end

# Turn on for easy debugging
DEBUG = false
if DEBUG
  require 'pry'
  Thread.current[:number] = 0
  binding.pry
  exit
end
#
# Further debugging can be done by using nc
#   $nc localhost 8844
# Should establish the connection dump all data packets and then exit

server = TCPServer.open("127.0.0.1", PORT)
loop do
  Thread.fork(server.accept) do |client|
    begin
      puts "Client connected"
      Thread.current[:number] = 0
      greet client
      puts "Client greeted"
      send_intro client
      puts "Client intro sent"
      stream_data client
      puts "Data sent"
      send_stop client
      puts "Stop sent"
      client.close
      puts "Client ending"
    rescue Exception => e
      puts e.message
      puts e.backtrace
      client.close
      exit
    end
  end
end
