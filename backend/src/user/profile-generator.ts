import { avataaarsNeutral } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';

export const generateProfilePicture = (): string => {
  const avatar = createAvatar(avataaarsNeutral, {
    size: 128,
  }).toDataUri();

  return avatar;
}