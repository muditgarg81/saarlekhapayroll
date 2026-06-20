import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll(@Request() req: any) {
    return this.usersService.findAll(req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Request() req: any, @Body() body: any) {
    return this.usersService.create(req.user.companyId, req.user.sub, body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.usersService.update(id, req.user.companyId, req.user.sub, body);
  }

  @Patch(':id/reset-password')
  @Roles('SUPER_ADMIN', 'ADMIN')
  resetPassword(@Param('id') id: string, @Request() req: any, @Body() body: { newPassword: string }) {
    return this.usersService.resetPassword(id, req.user.companyId, req.user.sub, body.newPassword);
  }
}
