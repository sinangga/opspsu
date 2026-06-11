
import { parsePibal } from "../lib/parsePibal";

const sandi = `UPID62 WIOP 091200
PPAA 59121 96565
55185 00505 
77999=

UGID62 WIOP 091200
PPBB 59121 96565
90/12 00000 28005 29504  
90345 33504 34005 00505  
906// 00508=`;

const result = parsePibal(sandi);
console.log(JSON.stringify(result, null, 2));
