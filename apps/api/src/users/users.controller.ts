import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { PublicUserEntity } from './dto/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';

@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(): Promise<PublicUserEntity[]> {
    return this.usersService.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<PublicUserEntity> {
    return this.usersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<PublicUserEntity> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string): Promise<PublicUserEntity> {
    return this.usersService.deactivate(id);
  }
}
