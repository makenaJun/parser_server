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
};
type TimeIntervalType = {
    from: string
    to: string
};

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
const getCountedPoints = (data: Array<DataType>, interval: TimeIntervalType) => {
    const filteredDate = data.filter(el => el.date >= interval.to && el.date < interval.from);
    return filteredDate.reduce((acc, el) => acc += Number(el.points), 0)
};
const requestContributions = async (name: string): Promise<HTMLDocument> => {
    const html = await instance.get(`/${name}/contributions`);
    return html.data;
};

const timeInterval = (dayCount: number): TimeIntervalType => {
    const toMilliseconds = Date.now() - dayCount * 86400000;
    return {
        from: new Date().toISOString().slice(0, 10),
        to: new Date(toMilliseconds).toISOString().slice(0, 10)
    }
};
const createResObj = (message: string, resultCode: number = 1) => {
    return JSON.stringify({
        message,
        resultCode
    })
};

const server = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
        if (request.url) {
            const url = new URL(request.url, serverOrigin);
            const query = parseQuery(url.search.substr(1));
            const {name, dayCount = 30} = query;

            if (url.pathname === '/contributions') {
                if (!name) {
                    response.statusCode = 400;
                    return response.end(createResObj(`Parameter 'Name' not transferred`));
                }
                if (!isFinite(dayCount) || dayCount === '') {
                    response.statusCode = 400;
                    return response.end(createResObj(`Parameter 'DayCount' not correct`));
                }
                if (dayCount > 365 && dayCount > 0) {
                    response.statusCode = 400;
                    return response.end(createResObj(`Value 'DayCount' must be in interval from 0 to 365.`));
                }
                try {
                    const html = await requestContributions(name);
                    const parsedData = getParsedData(html);
                    const interval = timeInterval(Number(dayCount));
                    const countedPoints = getCountedPoints(parsedData, interval);

                    const responseObg = {
                        points: countedPoints,
                        resultCode: 0
                    }

                    response.statusCode = 200;
                    return response.end(JSON.stringify(responseObg));
                } catch (error) {
                    if (error.response?.status === 404) {
                        response.statusCode = 404;
                        return response.end(createResObj('User not found'));
                    }
                    response.statusCode = 400;
                    return response.end(createResObj('Something went wrong'));
                }
            }
        }
    }
);


try {
    server.listen(PORT, hostname, () => {
        console.log(`Server running at http://${hostname}:${PORT}/`);
    });
} catch (error) {
    console.log(error);
}