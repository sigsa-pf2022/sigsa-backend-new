import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { hashSync } from 'bcrypt';
import { ValidateUserDto } from './dto/validate-user.dto';
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

  // async getFullUserByUsername(username: number) {
  //   return await this.userRepository.findOne({ where: { username } });
  // }
  async getFullUserByDni(dni: string) {
    return await this.userRepository.findOne({ where: { dni } });
  }

  async getUserByDni(dni: string) {
    return await this.userRepository.findOne({
      select: { firstName: true, lastName: true, dni: true },
      where: { dni },
    });
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    delete user.password;
    return user;
  }

  async getUsers() {
    return await this.userRepository.find();
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
    const user = await this.getUserByEmail(email);
    return user.emailVerified;
  }

  updateValidateStatus(user_id: number) {
    return this.userRepository.save({
      id: user_id,
      emailVerified: true,
      verificationCode: null,
    });
  }

  getMonthlyUserQuantity() {
    return this.userRepository.find({ select: { createdAt: true } });
  }
}
