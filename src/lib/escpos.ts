export const ESCPOS_COMMANDS = {
  INIT: new Uint8Array([0x1b, 0x40]),
  LF: new Uint8Array([0x0a]),
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  TEXT_DOUBLE_HEIGHT: new Uint8Array([0x1b, 0x21, 0x10]),
  TEXT_NORMAL: new Uint8Array([0x1b, 0x21, 0x00]),
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),
  OPEN_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
};

let cachedPort: any = null;
let cachedBluetoothDevice: any = null;

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function getHardwareCapabilities() {
  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const inIframe = isInsideIframe();

  return {
    serialSupported,
    bluetoothSupported,
    inIframe
  };
}

export async function connectPrinter() {
  if (cachedPort && cachedPort.readable) {
    return cachedPort;
  }
  
  if (isInsideIframe()) {
    throw new Error('Las APIs de hardware directo (USB/Serie) están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para vincular.');
  }

  if (!('serial' in navigator)) {
    throw new Error('Web Serial API no está soportada en este navegador. Utiliza Google Chrome o Microsoft Edge en tu PC o Mac.');
  }

  try {
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    cachedPort = port;
    return port;
  } catch (error: any) {
    if (
      error?.name === 'NotFoundError' || 
      error?.message?.includes('No port selected') || 
      error?.message?.includes('Failed to execute \'requestPort\' on \'Serial\'')
    ) {
      throw new Error('Selección de puerto cancelada.');
    }
    if (error?.name === 'SecurityError') {
      throw new Error('Permiso denegado por el navegador o bloqueado por el visor. Abre el sistema en una nueva pestaña del navegador.');
    }
    console.error('Error conectando impresora USB/Serie:', error);
    throw new Error(error?.message || 'No se pudo conectar con la impresora.');
  }
}

export async function checkPrinterConnection() {
  if (!('serial' in navigator)) return false;
  try {
    // @ts-ignore
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      if (!cachedPort) {
        cachedPort = ports[0];
        try {
          await cachedPort.open({ baudRate: 9600 });
        } catch (e) {
          // Ya abierto
        }
      }
      return true;
    }
  } catch (e) {}
  return false;
}

export async function openCashDrawer() {
  if (!await checkPrinterConnection()) {
    throw new Error('No hay impresora conectada.');
  }

  const writer = cachedPort.writable.getWriter();
  try {
    await writer.write(ESCPOS_COMMANDS.OPEN_DRAWER);
  } finally {
    writer.releaseLock();
  }
}

export async function printReceiptOverSerial(textLines: string[], openDrawer: boolean = false) {
  if (!await checkPrinterConnection()) {
    throw new Error('Debe conectar y emparejar una impresora térmica primero en Configuración.');
  }

  const writer = cachedPort.writable.getWriter();
  
  const writeCommand = async (cmd: Uint8Array) => {
    await writer.write(cmd);
  };

  const writeText = async (text: string) => {
    const encoder = new TextEncoder();
    const cleanText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    await writer.write(encoder.encode(cleanText));
  };

  try {
    await writeCommand(ESCPOS_COMMANDS.INIT);
    
    for (const line of textLines) {
      if (line === '---') {
        await writeText('-'.repeat(32));
        await writeCommand(ESCPOS_COMMANDS.LF);
      } else if (line === '===') {
        await writeText('='.repeat(32));
        await writeCommand(ESCPOS_COMMANDS.LF);
      } else if (line.startsWith('BOLD|')) {
        await writeCommand(ESCPOS_COMMANDS.BOLD_ON);
        await writeText(line.substring(5));
        await writeCommand(ESCPOS_COMMANDS.LF);
        await writeCommand(ESCPOS_COMMANDS.BOLD_OFF);
      } else if (line.startsWith('CENTER|')) {
        await writeCommand(ESCPOS_COMMANDS.ALIGN_CENTER);
        await writeText(line.substring(7));
        await writeCommand(ESCPOS_COMMANDS.LF);
        await writeCommand(ESCPOS_COMMANDS.ALIGN_LEFT);
      } else {
        await writeText(line);
        await writeCommand(ESCPOS_COMMANDS.LF);
      }
    }
    
    await writeCommand(ESCPOS_COMMANDS.LF);
    await writeCommand(ESCPOS_COMMANDS.LF);
    await writeCommand(ESCPOS_COMMANDS.LF);
    await writeCommand(ESCPOS_COMMANDS.CUT_PARTIAL);
    
    if (openDrawer) {
       await writeCommand(ESCPOS_COMMANDS.OPEN_DRAWER);
    }
  } finally {
    writer.releaseLock();
  }
}

export async function connectBluetoothPrinter() {
  if (isInsideIframe()) {
    throw new Error('Las APIs de Bluetooth están restringidas dentro de marcos (iframe). Abre la aplicación en una pestaña nueva para buscar dispositivos.');
  }

  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth no está disponible en este navegador o sistema operativo. Usa Google Chrome o Edge en Android, Mac o Windows.');
  }
  
  try {
    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });
    
    cachedBluetoothDevice = device;
    
    try {
      if (device.gatt && !device.gatt.connected) {
        await device.gatt.connect();
      }
    } catch (gattErr) {
      console.warn('GATT connection note:', gattErr);
    }
    
    return device;
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err?.message?.includes('User cancelled')) {
      throw new Error('Búsqueda de dispositivo cancelada.');
    }
    if (err.name === 'SecurityError') {
      throw new Error('Permiso de Bluetooth denegado. Asegúrate de abrir la app en una pestaña directa.');
    }
    throw new Error(err.message || 'Error al conectar con la impresora Bluetooth.');
  }
}

export async function testWifiPrinterConnection(ipAddress: string, port: number = 9100) {
  if (!ipAddress || !ipAddress.trim()) {
    throw new Error('Ingresa una dirección IP válida (ejemplo: 192.168.1.100).');
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipAddress.trim())) {
    throw new Error('Formato de IP no válido. Ejemplo esperado: 192.168.1.100');
  }
  return true;
}
