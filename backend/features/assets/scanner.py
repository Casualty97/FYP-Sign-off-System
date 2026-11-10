# Owner: Role 4, Ryan.
"""Send BLE observations as JSON lines; exit when the Node parent's stdin pipe closes."""
import asyncio
import json
import sys
import threading


def emit(message):
    print(json.dumps(message), flush=True)


async def main():
    from bleak import BleakScanner

    stopped = asyncio.Event()
    loop = asyncio.get_running_loop()

    def watch_parent():
        # A daemon thread avoids blocking BLE callbacks or keeping a failed scanner alive.
        for _ in sys.stdin:
            pass
        try:
            loop.call_soon_threadsafe(stopped.set)
        except RuntimeError:
            pass

    def detected(device, advertisement):
        if advertisement.service_uuids:
            emit({
                "type": "advertisement", "address": device.address,
                "name": advertisement.local_name or device.name,
                "rssi": advertisement.rssi, "service_uuids": advertisement.service_uuids,
            })

    threading.Thread(target=watch_parent, daemon=True).start()
    async with BleakScanner(detection_callback=detected):
        emit({"type": "ready"})
        while not stopped.is_set():
            try:
                await asyncio.wait_for(stopped.wait(), timeout=5)
            except asyncio.TimeoutError:
                emit({"type": "heartbeat"})


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        sys.exit(1)
