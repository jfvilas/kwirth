const { cac } = require('cac')
const cli = cac('kwirth-external')

function startApp(options) {
    console.log('🚀 Starting Kwirth External with these options:')

    process.env.CONTEXT = options.context  // +++ pending implement in back
    // (this option is not like electron (multpiple contexts), this option connects a Kwirth installation to a Kubernetes cluster, just one)
    process.env.ROOTPATH = options.rootpath
    process.env.MASTERKEY = options.masterkey
    process.env.FORWARD = options.forward
    process.env.PORT = options.port
    process.env.FRONT = options.front
    process.env.METRICSINTERVAL = options.metricsinterval
    process.env.CHANNEL_LOG = options.channellog
    process.env.CHANNEL_METRICS = options.channelmetrics
    process.env.CHANNEL_ALERT = options.channelalert
    process.env.CHANNEL_ECHO = options.channelecho
    process.env.CHANNEL_TRIVY = options.trivy
    process.env.CHANNEL_MAGNIFY = options.magnify
    process.env.CHANNEL_PINOCCHIO = options.pinocchio

    require('./bundle.js')
}

// CLI config
cli
  .option('-c, --context <string>', 'Context to load (defaults to current context', { default: '' })
  .option('-p, --port <number>', 'Server port', { default: 3883 })
  .option('-r, --rootpath <string>', 'Root path where Kwirth will be served', { default: '' })
  .option('-k, --masterkey <string>', 'Master key for enciphering tokens', { default: 'Kwirth4Ever' })
  .option('-t, --front', 'Enable front SPA serving', { default: false })
  .option('-f, --forward', 'FORWARD feature enabled or disabled', { default: false })
  .option('-i, --metricsinterval <number>', '', { default: 15 })
  .option('-cl, --channellog', 'Channel LOG enabled/disabled', { default: true })
  .option('-cm, --channelmetrics', 'Channel METRICS enabled/disabled', { default: true })
  .option('-ca, --channelalert', 'Channel ALERT enabled/disabled', { default: true })
  .option('-ce, --channelecho', 'Channel ECHO enabled/disabled', { default: true })
  .option('-co, --channelops', 'Channel OPS enabled/disabled', { default: true })
  .option('-ct, --channeltrivy', 'Channel TRIVY enabled/disabled', { default: true })
  .option('-cy, --channelmagnify', 'Channel MAGNIFY enabled/disabled', { default: true })
  .option('-cp, --channelpinocchio', 'Channel PINOCCHIO enabled/disabled', { default: true })

cli.command('', 'Main command')
    .action((options) => {
        startApp(options)
    })

cli.help()
try {
    cli.parse()
}
catch (err) {
    console.error('Error in arguments:', err.message)
    process.exit(1)
}