import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { hashSync } from 'bcrypt';
import { ValidateUserDto } from './dto/validate-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { random } from './utils/random-number';
import { User } from './entities/user.entity';
import { NormalUser } from './entities/normal-user.entity';
import { Role } from 'src/roles/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(  
    @InjectRepository(NormalUser)
    private normalUserRepository: Repository<NormalUser>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getUserByEmail(email: string) {
    return await this.userRepository.findOne({ where: { email } });
  }

  async existingUser(email: string, dni: string) {
    return await this.userRepository.findOne({ where: [{ email }, { dni }] });
  }

  // async getFullUserByUsername(username: number) {
  //   return await this.userRepository.findOne({ where: { username } });
  // }
  async getFullUserByDni(dni: string) {
    return await this.userRepository.findOne({ where: { dni } });
  }

  async getUserByDni(dni: string) {
    return await this.userRepository.findOne({
      select: { id: true, firstName: true, lastName: true, dni: true },
      where: { dni },
    });
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    // Puede no existir: un token sigue siendo válido después de borrar al
    // usuario. Sin esta guarda, el `delete` de abajo tiraba un 500.
    if (!user) return null;
    delete user.password;
    return user;
  }

  /**
   * Actualiza los datos editables del propio usuario ("Mis datos").
   * El DTO ya limita qué campos pueden llegar: email, dni, password y role
   * no son editables por acá.
   */
  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const fields = Object.fromEntries(
      Object.entries(updateUserDto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(fields).length) {
      await this.userRepository.update({ id }, fields);
    }

    return this.getUserById(id);
  }

  async getUsers(page, quantity) {
    return this.normalUserRepository.findAndCount({
      select:{
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
      take: quantity,
      skip: page * quantity,
      order: { firstName: 'ASC' },
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    const password = hashSync(createUserDto.password, 10);
    const newUser = this.normalUserRepository.create({
      ...createUserDto,
      password,
    });
    newUser.verificationCode = random();
    newUser.role = Role.User;
    const user = await this.normalUserRepository.save(newUser);
    return this.normalUserRepository.save(user);
  }

  async validateUser(validateUserDto: ValidateUserDto) {
    const user = await this.getUserByEmail(validateUserDto.email);
    return {
      user,
      isCodeCorrect:
        user[validateUserDto.field] === Number(validateUserDto.code),
    };
  }

  async resetPassword(data, user: User) {
    const password = hashSync(data.password, 10);
    const updatedUser = await this.userRepository.update(
      { id: user.id },
      {
        recoveryPasswordToken: null,
        password: password,
      },
    );
    return updatedUser;
  }

  async setRecoveryPasswordToken(user: User) {
    user.recoveryPasswordToken = random();
    return await this.userRepository.save(user);
  }
  async getUserStatus(email: string) {
    return await this.getUserByEmail(email);
  }

  updateValidateStatus(user_id: number) {
    return this.userRepository.save({
      id: user_id,
      emailVerified: true,
      verificationCode: null,
    });
  }

  getMonthlyUserQuantity() {
    return this.normalUserRepository.find({ select: { createdAt: true } });
  }
}
