
const koa = require('koa')
const compress = require('koa-compress')
const http = require('http')
const app = new koa();
const router = require('./router')
const path = require("path")
const chalk = require('chalk')


app.use(compress({
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
}))

app.use(router.routes())
app.use(router.allowedMethods())

app.use(require('koa-static')(path.resolve(__dirname, '../public'), {
    maxage: module.parent ? 1296000000 : 0
}))

const server = http.createServer(app.callback())

exports.listen = async()=>{
    
    server.listen(3000,()=>{
        console.log(chalk.yellowBright('\n Listening at http://localhost:3000 \n'))
    })
}