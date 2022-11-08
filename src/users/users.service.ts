import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import { hashSync } from 'bcrypt';
import { ValidateUserDto } from './dto/validate-user.dto';
import { random } from './utils/random-number';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getUserByEmail(email: string) {
    return await this.userRepository.findOne({ where: { email } });
  }

  async getFullUserByUsername(username: number) {
    return await this.userRepository.findOne({ where: { username } });
  }

  async getUserByUsername(username: number) {
    return await this.userRepository.findOne({
      select: { firstName: true, lastName: true, username: true },
      where: { username },
    });
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    delete user.password;
    return user;
  }

  async createUser(createUserDto: CreateUserDto) {
    const password = hashSync(createUserDto.password, 10);
    const newUser = this.userRepository.create({ ...createUserDto, password });
    newUser.verificationCode = random();
    const user = await this.userRepository.save(newUser);
    return this.userRepository.save({ ...user, username: user.id + 100000 });
  }

  async validateUser(validateUserDto: ValidateUserDto) {
    const user = await this.getUserByEmail(validateUserDto.email);
    return {
      user,
      isCodeCorrect:
        user.verificationCode === Number(validateUserDto.verificationCode),
    };
  }

  updateValidateStatus(user_id: number) {
    return this.userRepository.save({
      id: user_id,
      emailVerified: true,
      verificationCode: null,
    });
  }
}
