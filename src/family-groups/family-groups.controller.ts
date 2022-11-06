import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { FamilyGroup } from './entities/family-group.entity';
import { FamilyGroupsService } from './family-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('family-groups')
export class FamilyGroupsController {
  constructor(
    private readonly familyGroupService: FamilyGroupsService,
    private readonly userService: UsersService,
  ) {}

  @Post('/create')
  async createFamilyGroup(@Body() createFamilyGroupDto, @Req() request) {
    try {
      const user = await this.userService.getUserById(request.user.id);
      const { name, members, ...dependent } = createFamilyGroupDto;
      const userMembers = [];
      for (const member of members) {
        userMembers.push(
          await this.userService.getFullUserByUsername(member.username),
        );
      }
      const newFamilyGroup: FamilyGroup =
        await this.familyGroupService.createGroup(
          name,
          dependent,
          user,
          userMembers,
        );
      return { status: HttpStatus.CREATED, id: newFamilyGroup.id };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el grupo',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('/my-groups')
  async getFamilyGroupsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const groups = await this.familyGroupService.getFamilyGroupsByUser(user);
    return groups;
  }

  @Get('/:id')
  async getFamilyGroupById(@Req() request) {
    const group = await this.familyGroupService.getFamilyGroupById(
      request.params.id,
    );
    if (!group) {
      throw new HttpException(
        {
          message: 'No se encontro un grupo con el ID solicitado',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return group;
  }
}
