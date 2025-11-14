// vim: ts=4:sw=4:expandtab

import { generateKeyPair, calculateSignature } from './curve.js';
import { randomBytes } from 'crypto';

function isNonNegativeInteger(n) {
    return (typeof n === 'number' && (n % 1) === 0  && n >= 0);
}

export const generateIdentityKeyPair = generateKeyPair;

export function generateRegistrationId() {
    var registrationId = Uint16Array.from(randomBytes(2))[0];
    return registrationId & 0x3fff;
}

export function generateSignedPreKey(identityKeyPair, signedKeyId) {
    if (!(identityKeyPair.privKey instanceof Buffer) ||
        identityKeyPair.privKey.byteLength != 32 ||
        !(identityKeyPair.pubKey instanceof Buffer) ||
        identityKeyPair.pubKey.byteLength != 33) {
        throw new TypeError('Invalid argument for identityKeyPair');
    }
    if (!isNonNegativeInteger(signedKeyId)) {
        throw new TypeError('Invalid argument for signedKeyId: ' + signedKeyId);
    }
    const keyPair = generateKeyPair();
    const sig = calculateSignature(identityKeyPair.privKey, keyPair.pubKey);
    return {
        keyId: signedKeyId,
        keyPair: keyPair,
        signature: sig
    };
}

export function generatePreKey(keyId) {
    if (!isNonNegativeInteger(keyId)) {
        throw new TypeError('Invalid argument for keyId: ' + keyId);
    }
    const keyPair = generateKeyPair();
    return {
        keyId,
        keyPair
    };
}
