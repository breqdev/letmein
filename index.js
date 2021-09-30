require("dotenv").config()

const fs = require("fs").promises

const Koa = require("koa")
const app = new Koa()

const puppeteer = require("puppeteer")

const loadCookies = async () => {
    try {
        const cookies = await fs.readFile("./cookies.json")
        return JSON.parse(cookies)
    } catch (e) {
        return []
    }
}

const saveDuoCookies = async (page) => {
    const client = await page.target().createCDPSession()
    const cookies = (await client.send("Network.getAllCookies")).cookies.filter(
        (c) => c.domain === "api-6daaf5ea.duosecurity.com"
    )

    await fs.writeFile("./cookies.json", JSON.stringify(cookies))
}

app.use(async (ctx, next) => {
    if (ctx.path !== "/") {
        ctx.throw(404)
    } else {
        await next()
    }
})

app.use(async (ctx, next) => {
    ctx.browser = await puppeteer.launch({ headless: false })

    await next()

    // await ctx.browser.close()
})

app.use(async (ctx, next) => {
    const sso = await ctx.browser.newPage()

    await sso.setCookie(...(await loadCookies()))

    await sso.goto("https://my.northeastern.edu/group/student/services-links")

    await sso.waitForNavigation({
        waitUntil: "networkidle0",
    })

    // Type in the username and password

    const username = await sso.$("#username")
    const password = await sso.$("#password")

    await username.type(process.env.USERNAME)
    await password.type(process.env.PASSWORD)

    const submit = await sso.$("button")

    await submit.click()

    await sso.waitForSelector("#layout-column_column-1", {
        timeout: 0,
    })

    await saveDuoCookies(sso)

    await next()

    // await sso.close()
})

app.use(async (ctx, next) => {
    const hcc = await ctx.browser.newPage()

    await hcc.goto("https://huskycardcenter.neu.edu/student/welcome.php", {
        waitUntil: "networkidle0",
    })

    await hcc.goto("https://huskycardcenter.neu.edu/student/openmydoor.php", {
        waitUntil: "networkidle0",
    })

    const submit = await hcc.$(".mobileButton")

    await submit.click()

    await next()

    // await hcc.close()
})

app.use(async (ctx) => {
    ctx.body = "Hello World"
})

app.listen(3000)
