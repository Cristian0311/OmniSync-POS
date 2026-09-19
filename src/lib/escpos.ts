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

export async function connectPrinter() {
  if (cachedPort && cachedPort.readable) {
    return cachedPort;
  }
  
  if (!('serial' in navigator)) {
    throw new Error('Web Serial API no está soportada en este navegador (usa Chrome/Edge Desktop).');
  }

  try {
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    cachedPort = port;
    return port;
  } catch (error) {
    console.error('Error conectando impresora:', error);
    throw new Error('No se pudo conectar con la impresora.');
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
    // Para simplificar, utilizamos TextEncoder básico. ESC/POS requiere codepages específicos para tildes.
    const encoder = new TextEncoder();
    // Sustituir caracteres especiales básicos
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
    
    // Espaciado final y corte
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
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge en Android, Mac o Windows.');
  }
  try {
    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '00001101-0000-1000-8000-00805f9b34fb'
      ]
    });
    if (device.gatt) {
      await device.gatt.connect();
    }
    return device;
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      throw new Error('Búsqueda de impresora Bluetooth cancelada por el usuario.');
    }
    throw new Error('Error al conectar con la impresora Bluetooth: ' + (err.message || err));
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
