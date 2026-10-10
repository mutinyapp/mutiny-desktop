const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'port-reservations');
fs.mkdirSync(root, { recursive: true });
const original = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  let options;
  if (typeof args[0] === 'object') options = { ...args[0] };
  else if (typeof args[0] === 'number') options = { port: args[0], host: typeof args[1] === 'string' ? args[1] : '127.0.0.1' };
  else throw new Error('T27 refuses non-TCP listeners');
  options.host ??= '127.0.0.1';
  if (options.host !== '127.0.0.1') throw new Error(`T27 refuses host ${options.host}`);
  let reservation;
  if (options.port === 0) {
    for (let port = 49700; port <= 49719; port++) {
      const candidate = path.join(root, String(port));
      try { const fd = fs.openSync(candidate, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd); reservation = candidate; options.port = port; break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    if (!reservation) throw new Error('T27 exhausted owned ports');
  }
  if (!Number.isInteger(options.port) || options.port < 49700 || options.port > 49719) throw new Error(`T27 refuses port ${options.port}`);
  const release = () => { if (reservation) { fs.unlinkSync(reservation); reservation = undefined; } };
  this.once('close', release);
  this.once('error', release);
  this.once('listening', () => fs.appendFileSync(path.join(__dirname, 'port-bindings.jsonl'), JSON.stringify({ pid: process.pid, address: this.address(), time: new Date().toISOString() }) + '\n'));
  const callback = args.find(arg => typeof arg === 'function');
  return original.call(this, options, ...(callback ? [callback] : []));
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof normalized === 'object' ? normalized.host : (typeof args[1] === 'string' ? args[1] : '127.0.0.1');
  if (host && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error(`T27 refuses external connection ${host}`);
  return connect.apply(this, args);
};
