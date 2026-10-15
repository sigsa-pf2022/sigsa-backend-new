import { IsIn } from 'class-validator';
import { NotificationRecipientAction } from 'src/notifications/enums/notification-recipient-action.enum';

export class RespondNotificationDto {
  @IsIn([NotificationRecipientAction.TAKE_CHARGE, NotificationRecipientAction.DISCARD])
  action: NotificationRecipientAction;
}
