package com.billbyte.pos;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * Silent raw ESC/POS printing to a network thermal printer.
 *
 * Mirrors the desktop (Electron) printToThermal(): open a TCP socket to the
 * printer's ip:port (9100 = standard RAW/JetDirect), write the raw ESC/POS
 * bytes, close. No OS print dialog, no driver — the printer prints immediately.
 *
 * JS usage:
 *   EscPosPrinter.print({ ip: "192.168.1.50", port: 9100, data: <base64> })
 */
@CapacitorPlugin(name = "EscPosPrinter")
public class EscPosPrinterPlugin extends Plugin {

    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int WRITE_TIMEOUT_MS = 5000;

    @PluginMethod
    public void print(final PluginCall call) {
        final String ip = call.getString("ip");
        final int port = call.getInt("port", 9100);
        final String dataB64 = call.getString("data");

        if (ip == null || ip.trim().isEmpty()) {
            call.reject("Missing printer IP");
            return;
        }
        if (dataB64 == null || dataB64.isEmpty()) {
            call.reject("Missing print data");
            return;
        }

        // Networking must not run on the main thread.
        new Thread(new Runnable() {
            @Override
            public void run() {
                Socket socket = null;
                try {
                    byte[] bytes = Base64.decode(dataB64, Base64.DEFAULT);
                    socket = new Socket();
                    socket.setSoTimeout(WRITE_TIMEOUT_MS);
                    socket.connect(new InetSocketAddress(ip.trim(), port), CONNECT_TIMEOUT_MS);

                    OutputStream out = socket.getOutputStream();
                    out.write(bytes);
                    out.flush();

                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Print failed (" + ip + ":" + port + "): " + e.getMessage());
                } finally {
                    if (socket != null) {
                        try { socket.close(); } catch (Exception ignored) {}
                    }
                }
            }
        }).start();
    }
}
