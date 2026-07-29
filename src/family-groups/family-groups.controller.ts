import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Role } from 'src/roles/enums/role.enum';
import RoleGuard from 'src/roles/guards/role.guards';
import { UsersService } from 'src/users/users.service';
import { UpdateGroupPhotoDto } from './dto/update-group-photo.dto';
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

      const existingDnis = members.map((member) => member.dni);
      if (!existingDnis.includes(user.dni)) {
        userMembers.push(user);
      }

      for (const member of members) {
        const foundUser = await this.userService.getFullUserByDni(member.dni);
        if (!userMembers.find((u) => u.id === foundUser.id)) {
          userMembers.push(foundUser);
        }
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
        { message: 'No se pudo crear el grupo', status: 'error' },
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

  // Must be declared before /:id to avoid route collision
  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/dependents/search')
  async searchDependentByDni(@Query('dni') dni: string) {
    if (!dni) {
      throw new HttpException(
        { message: 'El parámetro dni es requerido', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const results = await this.familyGroupService.getDependentByDni(dni);
    return results;
  }

  @Get('/professional-requests')
  async getProfessionalRequests(@Req() request) {
    return this.familyGroupService.getPendingRequestsForUser(request.user.id);
  }

  @Patch('/professional-requests/:id/accept')
  async acceptProfessionalRequest(
    @Param('id') id: string,
    @Req() request,
  ) {
    try {
      return await this.familyGroupService.acceptProfessionalRequest(
        parseInt(id),
        request.user.id,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new HttpException(
          { message: error.message, status: 'error' },
          HttpStatus.FORBIDDEN,
        );
      }
      if (error instanceof NotFoundException) {
        throw new HttpException(
          { message: error.message, status: 'error' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { message: 'No se pudo aceptar la solicitud', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('/professional-requests/:id/reject')
  async rejectProfessionalRequest(
    @Param('id') id: string,
    @Req() request,
  ) {
    try {
      return await this.familyGroupService.rejectProfessionalRequest(
        parseInt(id),
        request.user.id,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new HttpException(
          { message: error.message, status: 'error' },
          HttpStatus.FORBIDDEN,
        );
      }
      if (error instanceof NotFoundException) {
        throw new HttpException(
          { message: error.message, status: 'error' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { message: 'No se pudo rechazar la solicitud', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('/:id')
  async getFamilyGroupById(@Req() request) {
    const group = await this.familyGroupService.getFamilyGroupById(
      request.params.id,
    );
    if (!group) {
      throw new HttpException(
        { message: 'No se encontro un grupo con el ID solicitado', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return group;
  }

  @Delete('/:groupId/members/:memberId')
  async removeMemberFromFamilyGroup(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Req() request,
  ) {
    try {
      const user = await this.userService.getUserById(request.user.id);
      const result = await this.familyGroupService.removeMemberFromGroup(
        parseInt(groupId),
        parseInt(memberId),
        user,
      );
      console.log({ groupId, memberId, userId: user.id, result });
      if (!result) {
        throw new HttpException(
          { message: 'No se pudo eliminar el miembro del grupo', status: 'error' },
          HttpStatus.BAD_REQUEST,
        );
      }
      return { status: HttpStatus.OK, message: 'Miembro eliminado correctamente' };
    } catch (error) {
      throw new HttpException(
        { message: 'Error al eliminar el miembro del grupo', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('/:groupId/photo')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateGroupPhoto(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupPhotoDto,
    @Req() request,
  ) {
    const user = await this.userService.getUserById(request.user.id);
    return this.familyGroupService.updateGroupPhoto(parseInt(groupId), dto.photo, user);
  }

  @Post('/:groupId/members')
  async addMemberToFamilyGroup(
    @Param('groupId') groupId: string,
    @Body() member: any,
    @Req() request,
  ) {
    try {
      const user = await this.userService.getUserById(request.user.id);
      const result = await this.familyGroupService.addMemberToGroup(
        parseInt(groupId),
        member,
        user,
      );
      if (!result) {
        throw new HttpException(
          { message: 'No se pudo agregar el miembro al grupo', status: 'error' },
          HttpStatus.BAD_REQUEST,
        );
      }
      return { status: HttpStatus.OK, message: 'Miembro agregado correctamente' };
    } catch (error) {
      throw new HttpException(
        { message: 'Error al agregar el miembro al grupo', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
