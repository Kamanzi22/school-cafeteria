module.exports = (io) => {
  io.on('connection', (socket) => {
    socket.on('join:restaurant', (id) => socket.join(`restaurant:${id}`));
    socket.on('join:order', (id) => socket.join(`order:${id}`));
    socket.on('leave:order', (id) => socket.leave(`order:${id}`));
    socket.on('disconnect', () => {});
  });
};
