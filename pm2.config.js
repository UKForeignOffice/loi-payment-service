module.exports = {
  apps : [
    {
      name      : 'payment',
      script    : "server.js",
      instances : "max",
      exec_mode : "cluster"
    }
  ]
}
