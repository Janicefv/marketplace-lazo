// Capa de negocio: registro e inicio de sesión (HU-01).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

const emailTaken = () =>
  ConflictError('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo electrónico.');

export function createAuthService({ userRepository, config }) {
  let dummyHash; // Para comparar contra algo cuando el correo no existe y no filtrar por tiempos.

  function issueToken(user) {
    const token = jwt.sign({ name: user.name }, config.jwt.secret, {
      subject: user.id,
      expiresIn: config.jwt.ttlSeconds,
      issuer: config.jwt.issuer,
      algorithm: 'HS256',
    });
    return { token, tokenType: 'Bearer', expiresIn: config.jwt.ttlSeconds };
  }

  return {
    async register({ name, email, password, phone }) {
      if (await userRepository.existsByEmail(email)) throw emailTaken();

      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      let user;
      try {
        user = await userRepository.create({ name, email, passwordHash, phone });
      } catch (err) {
        if (err.code === '23505') throw emailTaken(); // Dos registros simultáneos con el mismo correo.
        throw err;
      }
      return { user, ...issueToken(user) };
    },

    async login({ email, password }) {
      const found = await userRepository.findByEmailWithHash(email);
      dummyHash ??= await bcrypt.hash('usuario-inexistente', config.bcryptRounds);
      const valid = await bcrypt.compare(password, found?.passwordHash ?? dummyHash);
      if (!found || !valid) {
        throw UnauthorizedError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
      }
      const { passwordHash: _omit, ...user } = found;
      return { user, ...issueToken(user) };
    },

    async getProfile(userId) {
      const user = await userRepository.findById(userId);
      if (!user) throw NotFoundError('USER_NOT_FOUND', 'La cuenta ya no existe.');
      return user;
    },

    verifyToken(token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret, {
          algorithms: ['HS256'],
          issuer: config.jwt.issuer,
        });
        return { id: payload.sub, name: payload.name };
      } catch {
        throw UnauthorizedError('INVALID_TOKEN', 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
      }
    },
  };
}
