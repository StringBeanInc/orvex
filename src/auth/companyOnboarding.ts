// Deliberately finite, also independently validated by Firestore bootstrap rules.
export const companyTimeZones=['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Toronto','America/Vancouver','America/Mexico_City','America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Berlin','Africa/Johannesburg','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Pacific/Auckland'] as const;
export function onboardingInput(name:string,ownerName:string,phone='',timeZone='America/Chicago'){
 name=name.trim();ownerName=ownerName.trim();phone=phone.trim();
 if(!name||name.length>120||!ownerName||ownerName.length>120||/[\u0000-\u001f]/.test(name+ownerName))throw Error('Enter company and owner names of 1–120 characters.');
 if(phone.length>40||(phone&&(!/^[+0-9() .-]{3,40}$/.test(phone)||!/[0-9]/.test(phone))))throw Error('Enter a valid company phone number, or leave it blank.');
 if(!companyTimeZones.includes(timeZone as typeof companyTimeZones[number]))throw Error('Choose a supported company timezone.');
 return {name,ownerName,phone,timeZone};
}
