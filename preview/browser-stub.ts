// Used only by preview/vite.config.ts. Never sends messages or downloads files.
export const browser = {
  runtime: {
    async sendMessage(_message: unknown) {
      return { ok: true };
    },
  },
};
