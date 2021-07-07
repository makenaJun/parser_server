import {AxiosError, AxiosResponse} from 'axios';
import {IncomingMessage, ServerResponse} from 'http';
import {CheerioAPI, Element} from 'cheerio';

const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const {parse: parseQuery} = require('querystring');


const hostname = '127.0.0.1';
const PORT = 3000;
const serverOrigin = `https://${hostname}:${PORT}`;

const instance = axios.create({
    baseURL: 'https://github.com/users'
})

type DataType = {
    date: string
    points: string
}

const getParsedData = (html: HTMLDocument) => {
    const data: Array<DataType> = [];
    const $: CheerioAPI = cheerio.load(html);
    $('.js-calendar-graph-svg g').each((i, elem) => {
        Array.from(elem.children).forEach((el: Element) => {
            if (el.name === 'rect') {
                data.push({
                    date: el.attribs['data-date'],
                    points: el.attribs['data-level']
                })
            }
        })
    });
    return data;
};

const server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url) {
        const url = new URL(request.url, serverOrigin);
        const query = parseQuery(url.search.substr(1));
        const {name, dayCount} = query;

        if (url.pathname === '/contributions') {
            instance.get(`/${name}/contributions`)
                .then((res: AxiosResponse<HTMLDocument>) => {
                    const data = getParsedData(res.data)

                    const from = new Date().toISOString().slice(0, 10);
                    const toMilliseconds = Date.now() - Number(dayCount) * 86400000
                    const to = new Date(toMilliseconds).toISOString().slice(0, 10);

                    const filteredDate = data.filter(el => el.date >= to && el.date < from);
                    const countedPoints = filteredDate.reduce((acc, el) => acc += Number(el.points), 0);

                    const responseObg = {points: countedPoints}
                    response.statusCode = 200;
                    response.end(JSON.stringify(responseObg));
                })
                .catch((error: AxiosError) => {
                    const responseObg = {message: 'Not found'}
                    response.statusCode = 404;
                    response.end(JSON.stringify(responseObg));
                })
        }
    }
});


server.listen(PORT, hostname, () => {
    console.log(`Server running at http://${hostname}:${PORT}/`);
});