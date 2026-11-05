


import ably from "ably"


if (!process.env.ABLY_API_KEY) {
  throw new Error("ABLY_API_KEY is missing");
}

const {ABLY_API_KEY} = process.env;

export const ablyConfig = new ably.Realtime({
    key:ABLY_API_KEY
})
