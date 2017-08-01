This app is built to visualize the realtime tcp stream output by DSIStreamer

As such the following compoenets are present
* mock_eeg_server - a sample of the DSIStreamer server for development
* js_vis - a web visualization that connects to a websocket proxy (instructions included) of the DSIStreamer tcp stream
* real_time_render - a <TODO> based 3D rendering engine for the EEG data based on the TCP stream directly
..* Note: This could be done using the C API but this is technically much simpler and platform agnostic to boot. Some unwanted overhead may be introduced by this decision 
