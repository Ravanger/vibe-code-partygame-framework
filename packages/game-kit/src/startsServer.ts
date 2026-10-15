export const startsServer = (args: { usesDefaults: boolean; join: string | undefined }): boolean =>
  args.usesDefaults && args.join === undefined;
