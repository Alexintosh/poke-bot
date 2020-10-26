const fetch = require('node-fetch');

const fetchGasPrice = async () => {
    const query = `https://www.gasnow.org/api/v3/gas/price?utm_source=:pokebot`;
    const response = await fetch(query, {
        headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
        }
    });

    const gas = await response.json();

    return gas.data;
};

exports.fetchGasPrice = fetchGasPrice;