import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockQueryBuilder, MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { GroupEventAction } from 'src/group-events/enums/group-event-action.enum';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PatientProfessional } from 'src/professionals/entities/patient-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { PatientProfessionalStatus } from 'src/professionals/enums/patient-professional-status.enum';
import { UsersService } from 'src/users/users.service';
import { Dependent } from './entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';
import { FamilyGroupsService } from './family-groups.service';

describe('FamilyGroupsService', () => {
  let service: FamilyGroupsService;
  let groupRepo: MockRepository;
  let dependentRepo: MockRepository;
  let linkRepo: MockRepository;
  let professionalRepo: MockRepository;
  let users: { getFullUserByDni: jest.Mock; getUserById: jest.Mock };
  let notifications: { createForProfessionalLinkAccepted: jest.Mock };
  let groupEvents: { log: jest.Mock };

  const admin = { id: 1, firstName: 'Ana', lastName: 'Pérez', premium: false } as any;
  const member = { id: 2, firstName: 'Beto', lastName: 'Pérez' } as any;
  const outsider = { id: 99, firstName: 'Otro', lastName: 'Señor' } as any;
  const dependent = { id: 10, firstName: 'Tito', lastName: 'Pérez', dni: '50111222' };
  const newGroup = () => ({
    id: 100,
    name: 'Familia',
    createdBy: admin,
    members: [admin, member],
    dependent,
  });

  beforeEach(async () => {
    groupRepo = mockRepository();
    dependentRepo = mockRepository();
    linkRepo = mockRepository();
    professionalRepo = mockRepository();
    users = { getFullUserByDni: jest.fn(), getUserById: jest.fn() };
    notifications = { createForProfessionalLinkAccepted: jest.fn() };
    groupEvents = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: getRepositoryToken(FamilyGroup), useValue: groupRepo },
        { provide: getRepositoryToken(Dependent), useValue: dependentRepo },
        { provide: getRepositoryToken(PatientProfessional), useValue: linkRepo },
        { provide: getRepositoryToken(ProfessionalUser), useValue: professionalRepo },
        { provide: UsersService, useValue: users },
        { provide: NotificationsService, useValue: notifications },
        { provide: GroupEventsService, useValue: groupEvents },
      ],
    }).compile();

    service = module.get(FamilyGroupsService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('createGroup (límite del plan gratuito)', () => {
    it('crea el dependiente y el grupo mientras no llegó al tope', async () => {
      groupRepo.count.mockResolvedValue(4);
      dependentRepo.save.mockResolvedValue({ ...dependent });

      const saved = await service.createGroup('Familia', { firstName: 'Tito' } as any, admin, [admin]);

      expect(groupRepo.count).toHaveBeenCalledWith({ where: { createdBy: { id: 1 } } });
      expect(saved).toMatchObject({ name: 'Familia', createdBy: admin, members: [admin] });
      expect(saved.dependent).toEqual(dependent);
    });

    it('al llegar a 5 grupos rechaza sin crear el dependiente', async () => {
      groupRepo.count.mockResolvedValue(5);
      await expect(
        service.createGroup('Otra', {} as any, admin, [admin]),
      ).rejects.toThrow('Alcanzaste el límite del plan gratuito: hasta 5 grupos.');
      expect(dependentRepo.save).not.toHaveBeenCalled();
    });

    it('un premium no tiene tope', async () => {
      groupRepo.count.mockResolvedValue(20);
      await expect(
        service.createGroup('Otra', {} as any, { ...admin, premium: true }, []),
      ).resolves.toBeDefined();
    });
  });

  describe('consultas', () => {
    it('getFamilyGroupsByUser filtra por integrante', async () => {
      const qb = mockQueryBuilder({ getMany: [newGroup()] });
      groupRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(service.getFamilyGroupsByUser(admin)).resolves.toHaveLength(1);
      expect(qb.innerJoin).toHaveBeenCalledWith('fg.members', 'userMember', 'userMember.id = :userId', {
        userId: 1,
      });
    });

    it('getFamilyGroupById, getDependentById y findByDependentId consultan por id', async () => {
      await service.getFamilyGroupById(100);
      await service.getDependentById(10);
      await service.findByDependentId(10);
      expect(groupRepo.findOne.mock.calls[0][0].where).toEqual({ id: 100 });
      expect(dependentRepo.findOne).toHaveBeenCalledWith({ where: { id: 10 } });
      expect(groupRepo.findOne.mock.calls[1][0].where).toEqual({ dependent: { id: 10 } });
    });

    it('getDependentByDni arma la ficha con el responsable', async () => {
      groupRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder({ getMany: [newGroup()] }));
      await expect(service.getDependentByDni('50111222')).resolves.toEqual([
        {
          dependentId: 10,
          dependentFirstName: 'Tito',
          dependentLastName: 'Pérez',
          dependentDni: '50111222',
          groupId: 100,
          groupName: 'Familia',
          responsibleFirstName: 'Ana',
          responsibleLastName: 'Pérez',
        },
      ]);
    });
  });

  describe('addMemberToGroup', () => {
    it('false si el grupo no existe o el usuario no es parte', async () => {
      await expect(service.addMemberToGroup(100, { id: 3 }, outsider)).resolves.toBe(false);
    });

    it('false si el invitado no existe', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      users.getFullUserByDni.mockResolvedValue(null);
      await expect(service.addMemberToGroup(100, { dni: '1' }, admin)).resolves.toBe(false);
      await expect(service.addMemberToGroup(100, {}, admin)).resolves.toBe(false);
    });

    it('false si ya es integrante', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      users.getUserById.mockResolvedValue(member);
      await expect(service.addMemberToGroup(100, { id: 2 }, admin)).resolves.toBe(false);
      expect(groupRepo.save).not.toHaveBeenCalled();
    });

    it('cualquier integrante suma a alguien por DNI y queda en el historial', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      const nuevo = { id: 3, firstName: 'Caro', lastName: 'Gómez' };
      users.getFullUserByDni.mockResolvedValue(nuevo);

      await expect(service.addMemberToGroup(100, { dni: '30' }, member)).resolves.toBe(true);

      expect(groupRepo.save.mock.calls[0][0].members).toContain(nuevo);
      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 2,
          action: GroupEventAction.MEMBER_ADDED,
          targetId: 3,
          payload: { memberName: 'Caro Gómez' },
        }),
      );
    });
  });

  describe('removeMemberFromGroup', () => {
    it('false si el grupo no existe', async () => {
      await expect(service.removeMemberFromGroup(100, 2, admin)).resolves.toBe(false);
    });

    it('false si quien pide no pertenece al grupo', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 2, outsider)).resolves.toBe(false);
    });

    it('false si el que se quiere sacar no es integrante', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 50, admin)).resolves.toBe(false);
    });

    it('un integrante común no puede sacar a otro (ni al responsable)', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 1, member)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(groupRepo.save).not.toHaveBeenCalled();
    });

    it('el responsable saca a un integrante', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 2, admin)).resolves.toBe(true);
      expect(groupRepo.save.mock.calls[0][0].members.map((m) => m.id)).toEqual([1]);
      expect(groupEvents.log.mock.calls[0][0]).toMatchObject({
        action: GroupEventAction.MEMBER_REMOVED,
        payload: { memberName: 'Beto Pérez', selfRemoved: false },
      });
    });

    it('un integrante puede irse solo', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 2, member)).resolves.toBe(true);
      expect(groupEvents.log.mock.calls[0][0].payload.selfRemoved).toBe(true);
    });

    it('si se va el responsable, la administración pasa al siguiente integrante', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.removeMemberFromGroup(100, 1, admin)).resolves.toBe(true);
      expect(groupRepo.save.mock.calls[0][0].createdBy).toBe(member);
    });

    it('si se va el último, el grupo se borra sin escribir historial', async () => {
      groupRepo.findOne.mockResolvedValue({ ...newGroup(), members: [admin] });
      await expect(service.removeMemberFromGroup(100, 1, admin)).resolves.toBe(true);
      expect(groupRepo.remove).toHaveBeenCalled();
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('un error inesperado devuelve false', async () => {
      groupRepo.findOne.mockRejectedValue(new Error('db'));
      await expect(service.removeMemberFromGroup(100, 2, admin)).resolves.toBe(false);
    });
  });

  describe('updateGroupPhoto', () => {
    it('404 si el grupo no existe', async () => {
      await expect(service.updateGroupPhoto(100, 'x', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sólo un integrante la cambia', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.updateGroupPhoto(100, 'x', outsider)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.updateGroupPhoto(100, 'x', null)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un integrante la cambia', async () => {
      groupRepo.findOne.mockResolvedValue(newGroup());
      await expect(service.updateGroupPhoto(100, 'foto', member)).resolves.toEqual({
        id: 100,
        photo: 'foto',
      });
      expect(groupRepo.update).toHaveBeenCalledWith({ id: 100 }, { photo: 'foto' });
    });
  });

  describe('solicitudes de vinculación profesional (consentimiento)', () => {
    const pendingFor = (patientType: 'user' | 'dependent', patientId: number) => ({
      id: 500,
      professionalId: 40,
      patientType,
      patientId,
      status: PatientProfessionalStatus.PENDING,
      createdAt: new Date('2026-10-20'),
    });

    describe('getPendingRequestsForUser', () => {
      it('sin solicitudes devuelve lista vacía y no pide dependientes si no administra grupos', async () => {
        await expect(service.getPendingRequestsForUser(1)).resolves.toEqual([]);
        expect(linkRepo.find.mock.calls[0][0].where).toHaveLength(1);
      });

      it('junta las propias y las de los dependientes de sus grupos', async () => {
        groupRepo.find.mockResolvedValue([newGroup()]);
        linkRepo.find.mockResolvedValue([pendingFor('dependent', 10), { ...pendingFor('user', 1), id: 501 }]);
        professionalRepo.findOne
          .mockResolvedValueOnce({ firstName: 'Julia', lastName: 'Ruiz', licenseNumber: 'MP1', specialization: [{ id: 1 }] })
          .mockResolvedValueOnce(null);

        const result = await service.getPendingRequestsForUser(1);

        expect(linkRepo.find.mock.calls[0][0].where).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 500,
          forMe: false,
          dependentId: 10,
          dependentFirstName: 'Tito',
          groupId: 100,
          groupName: 'Familia',
          professionalFirstName: 'Julia',
          licenseNumber: 'MP1',
        });
        expect(result[1]).toMatchObject({
          id: 501,
          forMe: true,
          dependentId: null,
          groupId: null,
          professionalFirstName: '',
          licenseNumber: null,
          specialization: [],
        });
      });
    });

    describe('acceptProfessionalRequest', () => {
      it('404 si la solicitud no está pendiente', async () => {
        await expect(service.acceptProfessionalRequest(500, 1)).rejects.toBeInstanceOf(NotFoundException);
      });

      it('titular: sólo el propio paciente la acepta', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('user', 1));
        await expect(service.acceptProfessionalRequest(500, 2)).rejects.toBeInstanceOf(ForbiddenException);
        expect(linkRepo.save).not.toHaveBeenCalled();
      });

      it('titular: la acepta y avisa al profesional', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('user', 1));
        users.getUserById.mockResolvedValue({ firstName: 'ana', lastName: 'pérez' });

        await expect(service.acceptProfessionalRequest(500, 1)).resolves.toEqual({
          id: 500,
          status: PatientProfessionalStatus.ACCEPTED,
        });
        expect(linkRepo.save.mock.calls[0][0].resolvedAt).toBeInstanceOf(Date);
        expect(notifications.createForProfessionalLinkAccepted).toHaveBeenCalledWith({
          patientProfessionalId: 500,
          professionalUserId: 40,
          payload: { message: 'Tu solicitud de vinculación con Ana Pérez fue aceptada.' },
        });
      });

      it('titular inexistente: el aviso usa un nombre genérico', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('user', 1));
        users.getUserById.mockResolvedValue(null);
        await service.acceptProfessionalRequest(500, 1);
        expect(notifications.createForProfessionalLinkAccepted.mock.calls[0][0].payload.message).toContain(
          'El Paciente',
        );
      });

      it('dependiente: un integrante que no es responsable no puede aceptar', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        groupRepo.findOne.mockResolvedValue(newGroup());
        await expect(service.acceptProfessionalRequest(500, 2)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('dependiente sin grupo: prohibido', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        await expect(service.acceptProfessionalRequest(500, 1)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('dependiente: el responsable acepta, se avisa y queda en el historial', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        groupRepo.findOne.mockResolvedValue(newGroup());
        users.getUserById.mockResolvedValue({ firstName: 'Julia', lastName: 'Ruiz' });

        await expect(service.acceptProfessionalRequest(500, 1)).resolves.toEqual({
          id: 500,
          status: PatientProfessionalStatus.ACCEPTED,
        });
        expect(notifications.createForProfessionalLinkAccepted.mock.calls[0][0].payload).toEqual({
          dependentName: 'Tito Pérez',
          message: 'Tu solicitud de vinculación con Tito Pérez fue aceptada.',
        });
        expect(groupEvents.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: GroupEventAction.PROFESSIONAL_LINKED,
            targetId: 40,
            payload: { professionalName: 'Julia Ruiz', dependentName: 'Tito Pérez' },
          }),
        );
      });

      it('si no se encuentra al profesional, el historial dice "Profesional"', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        groupRepo.findOne.mockResolvedValue(newGroup());
        users.getUserById.mockResolvedValue(null);
        await service.acceptProfessionalRequest(500, 1);
        expect(groupEvents.log.mock.calls[0][0].payload.professionalName).toBe('Profesional');
      });
    });

    describe('rejectProfessionalRequest', () => {
      it('titular: sólo el propio paciente la rechaza', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('user', 1));
        await expect(service.rejectProfessionalRequest(500, 2)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('titular: la rechaza', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('user', 1));
        await expect(service.rejectProfessionalRequest(500, 1)).resolves.toEqual({
          id: 500,
          status: PatientProfessionalStatus.REJECTED,
        });
      });

      it('dependiente: sólo el responsable', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        groupRepo.findOne.mockResolvedValue(newGroup());
        await expect(service.rejectProfessionalRequest(500, 2)).rejects.toBeInstanceOf(ForbiddenException);
        groupRepo.findOne.mockResolvedValue(null);
        await expect(service.rejectProfessionalRequest(500, 1)).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('dependiente: el responsable la rechaza sin avisar a nadie', async () => {
        linkRepo.findOne.mockResolvedValue(pendingFor('dependent', 10));
        groupRepo.findOne.mockResolvedValue(newGroup());
        await expect(service.rejectProfessionalRequest(500, 1)).resolves.toMatchObject({
          status: PatientProfessionalStatus.REJECTED,
        });
        expect(notifications.createForProfessionalLinkAccepted).not.toHaveBeenCalled();
      });
    });
  });
});
