#!/usr/bin/env ruby

# A WebSocket to TCP socket proxy
# Copyright 2011 Joel Martin
# Licensed under LGPL version 3 (see docs/LICENSE.LGPL-3)

require 'pry'
require 'socket'
require 'json'
$: << "websocket"
$: << "../websocket"
require 'websocket'
require 'optparse'

# Proxy traffic to and from a WebSockets client to a normal TCP
# socket server target. All traffic to/from the client is base64
# encoded/decoded to allow binary data to be sent/received to/from
# the target.
class WebSocketProxy < WebSocketServer

  @@Traffic_legend = "
Traffic Legend:
    }  - Client receive
    }. - Client receive partial
    {  - Target receive

    >  - Target send
    >. - Target send partial
    <  - Client send
    <. - Client send partial
"


  def initialize(opts)
    vmsg "in WebSocketProxy.initialize"

    super(opts)

    @target_host = opts["target_host"]
    @target_port = opts["target_port"]
  end

  # Echo back whatever is received
  def new_websocket_client(client)

    msg "connecting to: %s:%s" % [@target_host, @target_port]
    tsock = TCPSocket.open(@target_host, @target_port)

    if @verbose then puts @@Traffic_legend end

    begin
      do_proxy(client, tsock)
    rescue
      tsock.shutdown(Socket::SHUT_RDWR)
      tsock.close
      raise
    end
  end

  HEADER_LENGTH = 12
  # TODO: All this buffer manipulation isn't very efficient, could be done a lot better using views/slices/chords which dont seem to exist in ruby
  # We could improve efficiency still by using byte counters instead of buffer copies
  def align_buf(buf)
    ret = []

    while !buf.nil? do
      if @carry_over
        buf = @carry_over + buf
        @carry_over = nil
      end


      if buf.size < 12
        @carry_over = buf
        buf = nil
        next # exit the loop and return
      end

      # We have a problem with our packets somewhere
      if buf[0...5] != "@ABCD"
        binding.pry
        raise "This should never happen"
      end

      # Read the type
      type,length,number = buf[5...14].unpack('CS>I>')

      # Calculate the carry_over based on the length
      expected_length = HEADER_LENGTH + length
      packet = nil
      if buf.size < expected_length
        @carry_over = buf
        buf = nil
      elsif buf.size > expected_length
        packet = buf[0...expected_length]
        buf = buf[expected_length...buf.size]# next buf
      else # buf.size == expected_length
        packet = buf
        buf = nil
      end

      # TODO: Parametrize this
      # Discard any packet except sensor data TYPE 1
      if type == 1 && !packet.nil?
        ret << packet
      end
    end

    ret
  end

  NCHANNELS = 7
  # TODO: Parameterize this to run in non json based mode
  def send_json(packets)
    # TODO: We may have multiple packets here. Verify this logic
    ret = 0
    packets.each do |packet|
      # At this point we can assume we have a data packet
      # We could care about the length but we ignore it for brevity assuming NCHANNELS

      # Parse out the sensor values and convert to json
      num_useless_bytes = HEADER_LENGTH + 4 + 1 + 6
      vals = packet[num_useless_bytes...(num_useless_bytes+NCHANNELS*4)].unpack(
        NCHANNELS.times.collect{"g"}.join
      )

      # TODO: Verify that send_frames actually sends complete messages
      #   if this isn't the case we should go back to packetizing client side
      # I think it is
      ret += send_frames([vals.to_json]) # TODO: should we change the thread version to send a string or convert the blob to a string later?
    end

    ret
  end

  # Proxy client WebSocket to normal target socket.
  def do_proxy(client, target)
    cqueue = []
    c_pend = 0
    tqueue = []
    rlist = [client, target]

    loop do
      wlist = []

      if tqueue.length > 0
        wlist << target
      end
      if cqueue.length > 0 || c_pend > 0
        wlist << client
      end

      ins, outs, excepts = IO.select(rlist, wlist, nil, 0.001)
      if excepts && excepts.length > 0
        raise Exception, "Socket exception"
      end

      # Send queued client data to the target
      if outs && outs.include?(target)
        dat = tqueue.shift
        sent = target.send(dat, 0)
        if sent == dat.length
          traffic ">"
        else
          tqueue.unshift(dat[sent...dat.length])
          traffic ".>"
        end
      end

      # Receive target data and queue for the client
      if ins && ins.include?(target)
        buf = target.recv(@@Buffer_size)
        if buf.length == 0
          raise EClose, "Target closed"
        end

        msg = align_buf(buf)

        unless msg.nil?
          msg.each do |m|
            cqueue << m
          end
        end
        traffic "{"
      end

      # Encode and send queued data to the client
      if outs && outs.include?(client)
        c_pend = send_json(cqueue) #send_frames(cqueue)
        cqueue = []
      end

      # Receive client data, decode it, and send it back
      if ins && ins.include?(client)
        frames, closed = recv_frames
        tqueue += frames

        if closed
          send_close
          raise EClose, closed
        end
      end

    end  # loop
  end
end

# Parse parameters
opts = {}
parser = OptionParser.new do |o|
  o.on('--verbose', '-v') { |b| opts['verbose'] = b }
  o.parse!
end

if ARGV.length < 2
  puts "Too few arguments"
  exit 2
end

# Parse host:port and convert ports to numbers
if ARGV[0].count(":") > 0
  opts['listen_host'], _, opts['listen_port'] = ARGV[0].rpartition(':')
else
  opts['listen_host'], opts['listen_port'] = nil, ARGV[0]
end

begin
  opts['listen_port'] = opts['listen_port'].to_i
rescue
  puts "Error parsing listen port"
  exit 2
end

if ARGV[1].count(":") > 0
  opts['target_host'], _, opts['target_port'] = ARGV[1].rpartition(':')
else
  puts "Error parsing target"
  exit 2
end

begin
  opts['target_port'] = opts['target_port'].to_i
rescue
  puts "Error parsing target port"
  exit 2
end

puts "Starting server on #{opts['listen_host']}:#{opts['listen_port']}"
server = WebSocketProxy.new(opts)
server.start(100)
server.join

puts "Server has been terminated"

# vim: sw=2
