export const config = {
    token: 'ETH',
    network: 'ARBITRUM', // if an invalid value is entered, you will get a list of available networks
    amount: 0.0009, // if you want to get random amounts, slightly increase this value
    randomizeAmount: true,  // if true, the final amount will be slightly less for a percent below
    spread: 0.5, // in percents, the final amount will be less for random percent up to this value, increase this value for a cheap coins to get more random values
    delay: { min: 5, max: 20 },  // in seconds
    apikey: '',
    secret: ''
}