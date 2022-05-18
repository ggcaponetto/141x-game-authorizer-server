require('dotenv').config()
const express = require('express');
const loglevel = require('loglevel');
const path = require("path");
const fs = require("fs");
const {Verifier} = require("../src/components/verifier/verifier");
const ll = loglevel.getLogger('main');
if (process.env.NODE_ENV === 'production') {
    ll.setLevel(ll.levels.DEBUG);
} else {
    ll.setLevel(ll.levels.DEBUG);
}

const verifier = new Verifier();

function run(){
    const app = express();
    let port = process.env.API_PORT;
    let network = process.env.NETWORK;

    app.use(express.json());
    app.use((req, res, next) => {
        console.log('Authentication', Date.now());
        let verifies = verifier.verify(req.headers['x-network'], req.headers['x-message'], req.headers['x-signingresponse'], req.headers['x-originatoraddress'])
        if(verifies){
            next()
        } else {
            res.status(401).send("Incorrect message signature")
        }
    })

    app.get('/', (req, res) => {
        res.send('Hello World!')
    })

    // e.g.
    // http://localhost:5002/files/portals/testnet/addr_test1qpj62c9adu6g9l0ytyn8wn7sce8ccnfscuh3z5xxwrn2jxa9jqga9h9v5d7k5ckl7qsve8zyr8kcd9m47yu3l0s6x5xs7jf4lx/myfirstportal/portals.vox
    app.get('/files/portals/:network/:address/:portal/:file', (req, res) => {
        const resolvedPath = path.resolve(`${__dirname}/../../141x-static-fs/files/portals/${req.params.network}/${req.params.address}/${req.params.portal}/${req.params.file}`);
        fs.readFile(resolvedPath, (err, data) => {
            ll.error(`fetching data from ${resolvedPath}`, data);
            try {
                if(data !== undefined){
                    res.status(200).send(data)
                } else {
                    res.status(404).send(data)
                }
            } catch (e) {
                ll.error(e.message);
                res.status(500).send(e.messages);
            }
        });
    })

    app.post('/files/portals/:network/:address/:portal/:file', (req, res) => {
        const resolvedPath = path.resolve(`${__dirname}/../../141x-static-fs/files/portals/${req.params.network}/${req.params.address}/${req.params.portal}/${req.params.file}`);
        ll.error(`posting data to ${resolvedPath}`, req.body);
        try {
            const resolvedPath = path.resolve(`${__dirname}/../../141x-static-fs/files/portals/${req.params.network}/${req.params.address}/${req.params.portal}/${req.params.file}`);
            fs.writeFile(resolvedPath, req.body.toString(), (err, data) => {
                if (err){
                    res.status(500).send(err.message)
                }
                res.status(201).send(data);
            });
        } catch (e) {
            ll.error(e.message);
            res.status(500).send(e.messages);
        }
    })

    app.listen(port, () => {
        ll.debug("MADAX API server is listening on port " + port + ". on the " + network);
    });
}

module.exports = {
    run
}